require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT;
const cors = require("cors");

const admin = require("firebase-admin");
const serviceAccount = require("./serviceKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
  MongoCredentials,
} = require("mongodb");

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const verifyToken = (req, res, next) => {
  next();
};

let movieCollections;

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("Movie-Master-Pro");
    movieCollections = db.collection("All Movies");

    //Find
    //FindOne

    app.get("/movies", async (req, res) => {
      const result = await movieCollections.find().toArray();
      res.send(result);
    });

    app.get("/movies/:id", async (req, res) => {
      const { id } = req.params;
      const result = await movieCollections.findOne({ _id: new ObjectId(id) });
      res.send({
        success: true,
        result,
      });
    });

    //Post Method
    //insertMany
    //insertOne

    app.post("/movies/add", async (req, res) => {
      const data = req.body;
      const result = await movieCollections.insertOne(data);
      res.send({ success: true, result });
    });

    //PUT
    //updateOne
    //updateMany

    app.put("/movies/update/:id", async (req, res) => {
      try {
        const { id } = req.params;

        // validate id
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid id" });
        }

        // copy body and remove _id if present to avoid trying to change immutable field
        const data = { ...req.body };
        if (data._id) delete data._id;

        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: data };

        const result = await movieCollections.updateOne(filter, updateDoc);

        // result.modifiedCount / matchedCount can be used to check success
        if (result.matchedCount === 0) {
          return res
            .status(404)
            .json({ success: false, message: "Movie not found" });
        }

        return res.json({ success: true, result });
      } catch (err) {
        console.error("PUT /allMovies/:id error:", err);
        return res.status(500).json({
          success: false,
          message: "Server error",
          error: String(err),
        });
      }
    });

    //delete
    //deleteOne
    //deleteMany
    app.delete("/movies/:id", async (req, res) => {
      try {
        const { id } = req.params;
        if (!ObjectId.isValid(id)) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid id" });
        }

        const result = await movieCollections.deleteOne({
          _id: new ObjectId(id),
        });

        if (result.deletedCount === 0) {
          return res
            .status(404)
            .json({ success: false, message: "Movie not found" });
        }

        return res.json({
          success: true,
          message: "Movie deleted",
          deletedCount: result.deletedCount,
        });
      } catch (err) {
        console.error("DELETE /allMovies/:id error:", err);
        return res.status(500).json({
          success: false,
          message: "Server error",
          error: String(err),
        });
      }
    });

    //Latest 6 Data
    //get
    //find

    app.get("/latest-movie", async (req, res) => {
      const result = await movieCollections
        .find()
        .sort({ created_at: -1 })
        .limit(6)
        .toArray();

      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
