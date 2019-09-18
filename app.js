const express = require("express");
const bodyParser = require("body-parser");
const graphqlHttp = require("express-graphql");
const { buildSchema } = require("graphql");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Event = require("./models/event");
const User = require("./models/user");

const app = express();

app.use(bodyParser.json());

app.use(
  "/graphql",
  graphqlHttp({
    schema: buildSchema(`
      type Event {
        _id: ID!
        title: String!
        description: String!
        price: Float!
        date: String!
      }

      type User {
        _id: ID!
        email: String!
        password: String
      }

      input EventInput {
        title: String!
        description: String!
        price: Float!
        date: String!
      }

      input UserInput {
        email: String!
        password: String!
      }

      type RootQuery {
        events: [Event!]!
      }

      type RootMutation {
        createEvent(eventInput: EventInput): Event
        createUser(userInput: UserInput): User
      }

      schema {
        query: RootQuery
        mutation: RootMutation
      }
    `),
    rootValue: {
      events: () => {
        return Event.find()
          .then(events => {
            return events.map(event => {
              // may also use event.id
              return { ...event._doc, _id: event._doc._id.toString() };
            });
          })
          .catch(err => {
            throw err;
          });
      },
      createEvent: args => {
        const { title, description, price, date } = args.eventInput;
        const event = new Event({
          title: title,
          description: description,
          price: +price,
          date: new Date(date),
          creator: "5d82ae644aa8fb3e1e0f103f"
        });
        let createdEvent;
        return event
          .save()
          .then(result => {
            createdEvent = { ...result._doc, _id: result._doc._id.toString() };
            return User.findById("5d82ae644aa8fb3e1e0f103f");
          })
          .then(user => {
            if (!user) {
              throw new Error("User not found");
            }
            user.createdEvents.push(event);
            return user.save();
          })
          .then(result => {
            return createdEvent;
          })
          .catch(err => {
            console.log(err);
            throw err;
          });
      },
      createUser: args => {
        const { email, password } = args.userInput;
        return User.findOne({ email: email })
          .then(user => {
            if (user) {
              throw new Error("User exists already.");
            }
            return bcrypt.hash(password, 12);
          })
          .then(hashedPassword => {
            const user = new User({
              email: email,
              password: hashedPassword
            });
            return user.save();
          })
          .then(result => {
            return { ...result._doc, password: null, _id: result.id };
          })
          .catch(err => {
            throw err;
          });
      }
    },
    graphiql: true
  })
);

mongoose
  .connect(
    `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@cluster0-d4viq.mongodb.net/${process.env.MONGO_DB}?retryWrites=true&w=majority`
  )
  .then(() => {
    app.listen(4000, () => console.log("Server listening on port 4000"));
  })
  .catch(err => {
    console.log(err);
  });
