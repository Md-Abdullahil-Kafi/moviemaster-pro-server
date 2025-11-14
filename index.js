require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT;
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = process.env.MONGODB_URI;
const admin = require("firebase-admin");
const serviceAccount = require("./serviceKey.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
app.use(cors());
app.use(express.json());

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = async (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "unauthorized Access" });
  }
  const token = authorization.split(" ")[1];
  try {
    const decodedUser = await admin.auth().verifyIdToken(token);
    req.decodedUser = decodedUser;
    next();
  } catch (error) {
    return res.status(401).send({ message: "unauthorized Access" });
  }
};


async function run() {
  try {
    await client.connect();
    const db = client.db("Movie-Master-Pro");
    const movieCollections = db.collection("All Movies");
    const watchedCollections = db.collection("watchList");

    app.get("/movies", async (req, res) => {
      const result = await movieCollections.find().toArray();
      res.send(result);
    });

    app.get("/movies/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      const result = await movieCollections.findOne({ _id: new ObjectId(id) });
      if (!result) {
        return res
          .status(404)
          .json({ success: false, message: "Movie not found" });
      }
      res.json({ success: true, result });
    });

    app.post("/movies/add", verifyToken, async (req, res) => {
      const data = req.body;
      const result = await movieCollections.insertOne(data);
      res.json({ success: true, result });
    });

    app.put("/movies/update/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      const data = { ...req.body };
      if (data._id) delete data._id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: data };
      const result = await movieCollections.updateOne(filter, updateDoc);
      if (result.matchedCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Movie not found" });
      }
      res.json({ success: true, result });
    });

    app.delete("/movies/:id", verifyToken, async (req, res) => {
      const { id } = req.params;
      if (!ObjectId.isValid(id)) {
        return res.status(400).json({ success: false, message: "Invalid ID" });
      }
      const result = await movieCollections.deleteOne({
        _id: new ObjectId(id),
      });
      if (result.deletedCount === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Movie not found" });
      }
      res.json({
        success: true,
        message: "Movie deleted",
        deletedCount: result.deletedCount,
      });
    });
    // Top 6 latestMovies
    app.get("/latest-movie", async (req, res) => {
      const result = await movieCollections
        .find()
        .sort({ created_at: -1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // Top Rated 5 Movies
    app.get("/topMovies", async (req, res) => {
      const result = await movieCollections
        .find()
        .sort({ rating: -1 })
        .limit(5)
        .toArray();
      res.send(result);
    });

    app.get("/movie/my-collection", verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        const result = await movieCollections
          .find({ addedBy: email })
          .toArray();
        res.json(result);
      } catch (error) {
        console.error("Error fetching movies:", error);
        res.status(500).json({ message: "Server error", error: error.message });
      }
    });

    //Genre Movie Filtering
    app.get("/genreMovies", async (req, res) => {
      try {
        const { genres, minRating, maxRating } = req.query;
        const filter = {};

        // 1) Genres filter
        if (genres) {
          const arr = genres
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean);
          filter.genre = { $in: arr };
        }

        // 2) Rating range filter
        if (minRating !== undefined || maxRating !== undefined) {
          const ratingFilter = {};
          if (minRating !== undefined && minRating !== "")
            ratingFilter.$gte = Number(minRating);
          if (maxRating !== undefined && maxRating !== "")
            ratingFilter.$lte = Number(maxRating);
          if (Object.keys(ratingFilter).length > 0) {
            filter.rating = ratingFilter;
          }
        }
        const result = await movieCollections.find(filter).toArray();
        res.send(result);
      } catch (err) {
        console.error("Error in /movies route:", err);
        res.status(500).send({ message: "Server error" });
      }
    });

    app.post("/myWatchList", async (req, res) => {
      const data = req.body;
      const result = await watchedCollections.insertOne(data);
      res.send(result);
    });

    app.get("/myWatchList", async (req, res) => {
      const result = await watchedCollections.find().toArray();
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB successfully!");
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
