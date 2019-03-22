const Express = require("express");
const BodyParser = require("body-parser");
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require("mongodb").ObjectID;

const imdb = require("./src/imdb");

const CONNECTION_URL = "mongodb+srv://denzel-api:WnQwBrgcbBtc0NQR@denzel-rudy-qwjlv.mongodb.net/test?retryWrites=true";
const DATABASE_NAME = "denzel";

const DENZEL_IMDB_ID = "nm0000243";

var app = Express();

app.use(BodyParser.json());
app.use(BodyParser.urlencoded({ extended: true }));

var database, collection;

app.listen(9292, () => {
    MongoClient.connect(CONNECTION_URL, { useNewUrlParser: true }, (error, client) => {
        if(error) {
            throw error;
        }

        database = client.db(DATABASE_NAME);
        collection = database.collection("movie");
        
        console.log("Connected to `" + DATABASE_NAME + "`!");
    });
});

app.get("/movies/populate", async(request, response) => {
    const movies = await imdb(DENZEL_IMDB_ID);

    collection.insertMany(movies, (err, result) => {
      if(err) {
        return response.status(500).send(err);
      }
    
      response.send("{\"total\": " + movies.length + "}")
    });
});

app.get("/movies", (request, response) => {
  collection.aggregate([
    { $match: { metascore: { $gte: 70 } } },
    { $sample: { size: 1 } }
  ]).toArray((error, result) => {
    if(error) {
      return response.status(500).send(error);
    }
    
    response.send(result);
  });
});

app.get("/movies/:id", (request, response) => {
  collection.find({ id: request.params.id }).limit(1).toArray((error, result) => {
    if(error) {
      return response.status(500).send(error);
    }

    response.send(result);
  });
});

app.get("/movies/search", (request, response) => {
  let metascore = 0;
  let limit = 5;

  if(typeof request.query.metascore !== 'undefined') {
    metascore = Number(request.query.metascore);
  }

  if(typeof request.query.limit !== 'undefined') {
    limit = Number(request.query.limit);
  }

  collection.aggregate([
    { $match: { metascore: { $gte: metascore }}},
    { $sample: { size: limit }}
  ]).sort({"metascore": -1}).toArray((error, result) => {
    if(error) {
      return response.status(500).send(error);
    }

    response.send("{\"limit\": " + limit + ",\"results\": " + JSON.stringify(result) + ", \"total\": " + result.length + "}");
  });
});

app.post("/movies/:id", (request, response) => {
  collection.updateOne({ "id": request.params.id }, { $set: request.body }, (error, result) => {
    if(error) {
      return response.status(500).send(error);
    }

    response.send(result);
  });
});