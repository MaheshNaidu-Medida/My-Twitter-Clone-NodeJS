const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const databasePath = path.join(__dirname, "twitterClone.db");

let database = null;
async function initializeDBAndServer() {
  try {
    database = await open({ filename: databasePath, driver: sqlite3.Database });
    app.listen(3000, () => console.log("Server is running..."));
  } catch (error) {
    console.log(`Database Error: ${error.message}`);
    process.exit(1);
  }
}
initializeDBAndServer();

//Authentication middleware
const authenticateUser = async (request, response, next) => {
  const tokenHeader = request.headers["authorization"];
  let jwtHeader;
  if (tokenHeader !== undefined) {
    jwtHeader = tokenHeader.split(" ")[1];
  }
  if (jwtHeader !== undefined) {
    jwt.verify(jwtHeader, "MN_SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const user = await database.get(getUserQuery);
  if (user === undefined) {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const getUserIdQuery = `
      SELECT MAX(user_id) AS ID FROM user;`;

      const userID = await database.get(getUserIdQuery);
      let ID = userID.ID;
      ID = ID + 1;
      const hashedPassword = await bcrypt.hash(password, 15);

      const addUserQuery = `
        INSERT INTO user(user_id,name,username,password,gender)
                VALUES(${ID},'${name}','${username}', '${hashedPassword}', '${gender}');`;

      await database.run(addUserQuery);
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user WHERE
    username = '${username}';`;
  const user = await database.get(getUserQuery);
  if (user !== undefined) {
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (isPasswordValid === true) {
      const payLoad = { username: username };
      const jwtToken = jwt.sign(payLoad, "MN_SECRET");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

app.get("/user/tweets/feed/", authenticateUser, async (request, response) => {
  const { username } = request;
  const getTweetsQuery = `
    SELECT u2.username AS username,tweet.tweet AS tweet,tweet.date_time AS dateTime
    FROM user u1 INNER JOIN follower
    ON u1.user_id = follower.follower_user_id 
    INNER JOIN tweet ON follower.following_user_id = tweet.user_id
    INNER JOIN user u2 ON tweet.user_id = u2.user_id 
    WHERE u1.username = '${username}'
    ORDER BY tweet.date_time DESC
    LIMIT 4;`;
  const tweetsArray = await database.all(getTweetsQuery);
  response.send(tweetsArray);
});

app.get("/user/following/", authenticateUser, async (request, response) => {
  const { username } = request;
  const getCelebsQuery = `
  SELECT u2.name AS name
  FROM user u1 INNER JOIN follower
  ON u1.user_id = follower.follower_user_id 
  INNER JOIN user u2 on follower.following_user_id = u2.user_id
  WHERE 
  u1.username = '${username}';`;
  const celebsArray = await database.all(getCelebsQuery);
  response.send(celebsArray);
});

app.get("/user/followers/", authenticateUser, async (request, response) => {
  const { username } = request;
  const getFollowersQuery = `
    SELECT u2.name AS name
    FROM user u1 INNER JOIN follower 
    ON u1.user_id = follower.following_user_id
    INNER JOIN user u2 ON follower.follower_user_id = u2.user_id
    WHERE u1.username = '${username}';`;
  const followersArray = await database.all(getFollowersQuery);
  response.send(followersArray);
});

app.get("/tweets/:tweetId/", authenticateUser, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;

  const getValidTweetsQuery = `
    SELECT tweet.tweet AS tweet,
    COUNT(DISTINCT like.like_id) AS likes,
    COUNT(DISTINCT reply.reply_id) AS replies,
    tweet.date_time AS dateTime
    FROM tweet LEFT JOIN like ON tweet.tweet_id = like.tweet_id
    LEFT JOIN reply ON like.tweet_id = reply.tweet_id
    WHERE tweet.user_id IN (SELECT
        follower.following_user_id
        FROM user INNER JOIN follower
        ON user.user_id = follower.follower_user_id
        WHERE user.username = '${username}')
    AND tweet.tweet_id = ${tweetId}
    GROUP BY tweet.tweet_id;`;
  const validTweet = await database.get(getValidTweetsQuery);
  if (validTweet !== undefined) {
    response.send(validTweet);
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});

app.get(
  "/tweets/:tweetId/likes/",
  authenticateUser,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;

    const getValidTweetQuery = `
    SELECT user.username AS username
    FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
    INNER JOIN user ON like.user_id = user.user_id
    WHERE tweet.user_id IN (SELECT follower.following_user_id
        FROM user INNER JOIN follower
        ON user.user_id = follower.follower_user_id
        WHERE user.username = '${username}')
    AND tweet.tweet_id = ${tweetId};`;
    const usersWhoLiked = await database.all(getValidTweetQuery);

    if (usersWhoLiked.length !== 0) {
      response.send({
        likes: usersWhoLiked.map((eachUser) => eachUser.username),
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get(
  "/tweets/:tweetId/replies/",
  authenticateUser,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const getValidTweetQuery = `
    SELECT user.name AS name,reply.reply AS reply
    FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
    INNER JOIN user ON reply.user_id = user.user_id
    WHERE tweet.user_id IN (SELECT follower.following_user_id
        FROM user INNER JOIN follower
        ON user.user_id = follower.follower_user_id
        WHERE user.username = '${username}')
    AND tweet.tweet_id = ${tweetId};`;
    const usersWhoReplied = await database.all(getValidTweetQuery);

    if (usersWhoReplied.length !== 0) {
      response.send({ replies: usersWhoReplied });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

app.get("/user/tweets/", authenticateUser, async (request, response) => {
  const { username } = request.body;
  const getAlLTweetsQuery = `
    SELECT 
    tweet.tweet AS tweet,
    COUNT(DISTINCT like.like_id) AS likes,
    COUNT(DISTINCT reply.reply_id) AS replies,
    tweet.date_time AS dateTime
    FROM tweet LEFT JOIN like ON tweet.tweet_id = like.tweet_id
    LEFT JOIN reply ON like.tweet_id = reply.tweet_id
    WHERE 
    tweet.user_id = (SELECT user_id FROM user
        WHERE username = '${username}')
    GROUP BY tweet.tweet_id;`;
  const tweetsSummaryArray = await database.all(getAlLTweetsQuery);
  response.send(tweetsSummaryArray);
});

app.post("/user/tweets/", authenticateUser, async (request, response) => {
  const { username, tweet } = request.body;
  //create tweet ID
  const getMaxTweetIdQuery = `SELECT MAX(tweet_id) AS max FROM tweet;`;
  const maxId = await database.get(getMaxTweetIdQuery);
  let { max } = maxId;
  const ID = max + 1;
  //create user_id
  const getUserIdQuery = `SELECT user_id AS userId FROM user WHERE username = '${username}';`;
  const userIdObj = await database.get(getUserIdQuery);
  const { userId } = userIdObj;
  //create instant date
  const todayDate = new Date();

  const createTweetQuery = `
    INSERT INTO tweet(tweet)
                 VALUES( '${tweet}' );`;
  if (tweet !== "" && tweet !== undefined) {
    await database.run(createTweetQuery);
    response.send("Created a Tweet");
  } else {
    response.status(400);
    response.send("Empty tweet not allowed");
  }
});

app.delete("/tweets/:tweetId/", authenticateUser, async (request, response) => {
  const { tweetId } = request.params;
  console.log(tweetId);
  const { username } = request;
  const getTweetIdQuery = `SELECT tweet_id FROM tweet WHERE user_id =
  (SELECT user_id FROM user WHERE username = '${username}')
  AND tweet_id = ${tweetId};`;
  const userIdObj = await database.get(getTweetIdQuery);
  if (userIdObj !== undefined) {
    const deleteTweetQuery = `
    DELETE FROM tweet
    WHERE tweet.user_id = (SELECT user_id FROM user WHERE username = '${username}')
    AND tweet.tweet_id = ${tweetId};`;
    await database.run(deleteTweetQuery);
    response.send("Tweet Removed");
  } else {
    response.status(401);
    response.send("Invalid Request");
  }
});
module.exports = app;
