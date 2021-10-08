const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const databasePath = path.join(__dirname, "anime.db");

const responseFlightHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Credentials": true,
  "Access-Control-Allow-Methods": "POST, GET, DELETE, PUT", /* I had used all four 'SINGLE EACH METHOD' like 'GET' in this line. Couldn't able to find how to exactly write this value so wrote all four. */ 
  "Access-Control-Allow-Headers": "Content-Type",
};

let database = null;
async function initializeDBAndServer() {
  try {
    const port = process.env.PORT || 9001;
    database = await open({ filename: databasePath, driver: sqlite3.Database });
    app.listen(port, () => console.log(`Server is running at ${port}`));
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
  const reviewsArray = await database.all(getReviewsQuery);
  response.status(200);
  response.set(responseFlightHeaders);
  response.send(reviewsArray);

app.post("/create-review/", async (request, response) => {
  const { reviews } = request.body;
  const { review, rating, pin, id } = reviews;
  const createReviewQuery = `
    INSERT INTO reviews
    (id,pin,review,rating)
    VALUES(${id}, ${pin},${review}, ${rating});`;
  if (id !== "" && rating !== "") {
    await database.run(createReviewQuery);
    response.status(200);
    response.set(responseFlightHeaders);
    response.send("Review Added Successfully");
  } else {
    response.status(401);
    response.set(responseFlightHeaders);
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
    response.set(responseFlightHeaders);
    response.send("Invalid details");
  } else {
    await database.run(deleteReviewQuery);
    response.status(200);
    response.set(responseFlightHeaders);
    response.send("Review Deleted Successfully");
  }
});

module.exports = app;
