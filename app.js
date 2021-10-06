const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const databasePath = path.join(__dirname, "anime.db");

let database = null;
async function initializeDBAndServer() {
  try {
    database = await open({ filename: databasePath, driver: sqlite3.Database });
    app.listen(process.env.PORT || 9001, () =>
      console.log("Server is running...")
    );
  } catch (error) {
    console.log(`Database Error: ${error.message}`);
    process.exit(1);
  }
}
initializeDBAndServer();

app.get("/reviews/", async (request, response) => {
  const getReviewsQuery = `
    SELECT  *
    FROM reviews`;
  const reviewsArray = await database.get(getReviewsQuery);
  response.status(200);
  response.send(reviewsArray);
});

app.post("/create-review/", async (request, response) => {
  const { reviews } = request.body;
  const { review, rating, pin, id } = reviews;
  const createReviewQuery = `
    INSERT INTO reviews
    (id,pin,review,rating)
    VALUES(${animeId}, ${pin},${review}, ${rating};`;
  if (rating !== "") {
    await database.run(createReviewQuery);
    response.status(200);
    response.send("Review Added Successfully");
  } else {
    response.status(401);
    response.send("Review not added. Rating is invalid");
  }
});

app.delete("/delete-review/", async (request, response) => {
  const { item } = request.body;
  const { id, pin } = item;
  const deleteReviewQuery = `
    DELETE FROM reviews
    WHERE id=${id} AND pin=${pin};
    `;

  if (id === "" || pin === "") {
    response.status(400);
    response.send("Invalid details");
  } else {
    await database.run(deleteReviewQuery);
    response.status(200);
    response.send("Review Deleted Successfully");
  }
});

module.exports = app;
