const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());

const databasePath = path.join(__dirname, "anime.db");

let database = null;
async function initializeDBAndServer() {
  try {
    database = await open({ filename: databasePath, driver: sqlite3.Database });
    app.listen(process.env.PORT || 3000, () =>
      console.log("Server is running...")
    );
  } catch (error) {
    console.log(`Database Error: ${error.message}`);
    process.exit(1);
  }
}
initializeDBAndServer();

app.get("/reviews/", async (request, response) => {
  const getAllReviewsQuery = `
    SELECT * FROM
    reviews;
    `;

  const reviewsArray = await database.all(getAllReviewsQuery);
  response.send(reviewsArray);
});

app.post("/create-review/:animeId", async (request, response) => {
  const { animeId } = request.params;
  const { reviews } = request.body;
  const { review, rating } = reviews;
  const createReviewQuery = `
    INSERT INTO reviews(id, review, rating) VALUES(${animeId}, ${review}, ${rating});`;

  const creationResponse = await database.run(createReviewQuery);
  if (creationResponse.ok) {
    response.send(creationResponse);
  } else {
    response.status(401);
    response.send(creationResponse.message);
  }
});

app.put("/update-review/:animeId", async (request, response) => {
  const { animeId } = request.params;
  const { reviews } = request.body;
  const { review, rating } = reviews;
  const updateReviewQuery = `
    UPDATE reviews 
    SET 
    review = ${review},
    rating = ${rating}
    WHERE id = ${animeId};

    `;

  const updationResponse = await database.run(updateReviewQuery);
  if (updationResponse.ok) {
    response.send(updationResponse);
  } else {
    response.status(401);
    response.send(updationResponse.message);
  }
});

module.exports = app;
