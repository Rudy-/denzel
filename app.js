const Express = require("express");
const BodyParser = require("body-parser");
const lodash = require('lodash');
const MongoClient = require("mongodb").MongoClient;
const ObjectId = require("mongodb").ObjectID;

const imdb = require("./src/imdb");

const graphqlHTTP = require('express-graphql');
const { GraphQLSchema } = require('graphql');
const { GraphQLObjectType, GraphQLString, GraphQLInt, GraphQLList, GraphQL } = require('graphql');

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
  collection.updateOne({ "id": request.params.id }, { $set: { "date": request.query.date, "review": request.query.review }}, (error, result) => {
    if(error) {
      return response.status(500).send(error);
    }

    response.send(result);
  });
});

const movieType = new GraphQLObjectType({
  name: 'Movie',
  fields: {
    id : { type : GraphQLString },
    link: { type: GraphQLString },
    metascore: { type: GraphQLInt },
    synopsis: { type: GraphQLString },
    title: { type: GraphQLString },
    year: { type: GraphQLInt },
    date: { type:GraphQLString },
    review: { type:GraphQLString }
  }
});

const queryType = new GraphQLObjectType({
  name: 'Query',
  fields: {
    populateMovies: {
      type: GraphQLString,

      resolve: async function() {
        if(collection.countDocuments() == 0) {
          var denzel = await imdb(DENZEL_IMDB_ID);
          
          collection.insertMany(denzel);

          return "The database is populated with " + collection.countDocuments() + ".";
        }
      }
    },

    movies: {
      type: movieType,
      args: { id: { type: GraphQLString }},

      resolve: async function(source, args) {
        data = await collection.find().toArray();

        return lodash.find(data, { id: args.id });
      }
    },

    randomMovie: {
      type: movieType,

      resolve: async function() {
        data = await collection.aggregate([
          { $match: { metascore: { $gte: 70 } } },
          { $sample: { size: 1 } }
        ]).toArray();
        
        return data;
      }
    },

    searchMovie:{
      type: new GraphQLList(movieType),
      args: {
        limit: { type: GraphQLString },
        metascore:{ type: GraphQLString }
      },

      resolve: async function (source, args) {
        let meta = 0;
        let limit = 5;
            
        meta = Number(args.metascore);
        limit = Number(args.limit);
            
        data = await collection.find({"metascore": { $gte: meta }}).sort({"metascore": -1}).toArray();
          
        var result = [];
        
        for(let i = 0; i < limit; i++)
        {
          if(data[i] != null){
            result.push(data[i]);
          }
        }
      
        return result;
      }
    },

    reviewMovie: {
      type: movieType,
      args: {
        id: { type:GraphQLString },
        date: { type: GraphQLString },
        review:{ type: GraphQLString }
      },

      resolve: async function(source, args) {
        collection.updateOne({ "id": args.id }, { $set: { "date": args.date, "review": args.review }});
        
        data = await collection.find().toArray();
        
        return lodash.find(data, { id: args.id });
      }
    }
  }
});

const schema = new GraphQLSchema({ query: queryType });

app.use('/graphql', graphqlHTTP({
  schema: schema,
  graphiql: true,
}));