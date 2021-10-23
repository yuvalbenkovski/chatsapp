const path = require("path");
if (process.env.NODE_ENV === "production") {
  console.log("Running in production");
} else {
  console.log("Running in development");
  require("dotenv").config({ path: path.join(__dirname, '../.env') });
}


//Env
const dbUrl = process.env.DB_URL || "mongodb://localhost:27017/chats-app"
const secret = process.env.SESSION_SECRET


//Variables
const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const MongoStore = require('connect-mongo');
const { User } = require("./models/user");
const flash = require("connect-flash");
const sessionConfig = {
  secret,
  store: MongoStore.create({
    mongoUrl: dbUrl,
    mongoOptions: { useUnifiedTopology: true },
    crypto: {
      secret
    },
  }),
  resave: false,
  saveUninitialized: true,
  name: "session",
  cookie: {
    httpOnly: true,
    /*     secure: true, */
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
};
const sessionMiddleware = session(sessionConfig);


//Routers
const indexRouter = require('./routers/indexRouter')
const authRouter = require('./routers/authRouter')


//DB connection
mongoose.connect(dbUrl, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "connection error:"));
db.once("open", function () {
  console.log("Mongoose Connected !");
});


//Set view engine to EJS
app.set("view engine", "ejs");


//Express middleware
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(flash());
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());


//Passport middleware
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());


//Local properties
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});


//Router middleware
app.use(indexRouter)
app.use(authRouter)


//Socket.io
const socketio = require("socket.io");
const io = socketio(server);
const { formatMessage } = require("./public/utilities/messages.js");
const moment = require("moment");
const { Notification } = require("./models/user");
const { Room, Message } = require("./models/room");

io.on("connection", (socket) => {
  //Return socket object of a user
  const getSocket = function (userData) {
    return io.sockets.sockets.get(userData.socket_id);
  };
  //List of all current sockets
  const clients = [];
  io.sockets.sockets.forEach(function (data) {
    clients.push(data.id);
  });
  socket.on("newConnection", async currentUser => {
    //Link socket id to current logged in user and store in database
    await User.findOneAndUpdate(
      { username: currentUser },
      { socket_id: socket.id },
      { new: true }
    );
    //Global current user
    const user = await User.findOne(
      { username: currentUser }
    );
    //Reset DB for testing purposes
    /*     await Message.deleteMany({})
        await Room.deleteMany({})
        user.contacts_list = []
        user.rooms = []
        user.notifications = []
        user.current_room = undefined
        user.save() */
    //Render notifications
    setTimeout(() => {
      if (user.notifications) {
        socket.emit("renderNotifications", user.notifications);
      }
    }, 1000);


    socket.on("requestRooms", async (username) => {
      const updatedUser = await User.findOne({ username })
      console.log(updatedUser)
      const roomData = [];
      if (updatedUser.rooms) {
        for (let room of updatedUser.rooms) {
          const foundRoom = await Room.findOne({ room_name: room });
          const filteredUser = foundRoom.members
            .filter((e) => e !== currentUser)
            .toString();
          const foundUser = await User.findOne({ username: filteredUser });
          const data = {
            username: foundUser.username,
            name: foundUser.name,
            about: foundUser.about,
            profilePicture: foundUser.profile_picture.path,
            roomName: room,
            lastMessage: {}
          }
          if (foundRoom.messages.length) {
            data.lastMessage.body =
              foundRoom.messages[foundRoom.messages.length - 1].body;
            data.lastMessage.time =
              foundRoom.messages[foundRoom.messages.length - 1].time;
          }
          roomData.push(data);
        }
      }
      socket.emit("renderRooms", roomData);
    })


    socket.on("createRoom", async (clickedUser) => {
      const clickedUserData = await User.findOne({ username: clickedUser });
      const roomName = `${currentUser}-${clickedUser}`;
      const createRoom = async () => {
        //Check to see if room already exists
        const isRoom = await Room.findOne({ room_name: roomName });
        //Check to see if a room name with the switched users exists
        const flippedRoom = await Room.findOne({
          room_name: `${clickedUser}-${currentUser}`,
        });
        if (!isRoom && !flippedRoom) {
          //Create new room document
          new Room({
            room_name: roomName,
            members: [currentUser, clickedUser],
          }).save();
          //Add room to users model
          const addToUsers = (arr, roomName) => {
            arr.forEach((user) => {
              user.rooms.push(roomName);
              //Update current room
              user.current_room = roomName
              user.save();
            });
          };
          //Execute
          addToUsers([user, clickedUserData], roomName);
          //Join user to room on click
          getSocket(user).join(roomName);
        } else {
          console.log("Room already exists or user is already joined");
        }
      };
      createRoom();
    });


    socket.on("renderUser", async (username) => {
      const foundUser = await User.findOne({ username });
      socket.emit("renderedUser", foundUser);
    });


    socket.on("focusRoom", async (clickedUser, room) => {
      const updatedUser = await User.findOne({ username: currentUser })
      getSocket(updatedUser).leave(updatedUser.current_room)
      //Reset notifications in DB and clientside
      setTimeout(async () => {
        if (updatedUser.notifications) {
          for (let notification of updatedUser.notifications) {
            if (notification.from_room === room) {
              updatedUser.notifications.id(notification._id).remove();
              updatedUser.save();
              socket.emit("resetNotifications", room);
            }
          }
        }
        //Validate room and update in template
        async function validateRoom() {
          let room = await Room.findOne({
            room_name: `${currentUser}-${clickedUser}`,
          });
          if (room) {
            return room.room_name;
          }
          let roomOpposite = await Room.findOne({
            room_name: `${clickedUser}-${currentUser}`,
          });
          if (roomOpposite) {
            return roomOpposite.room_name;
          } else {
            return "no rooms found";
          }
        }
        const targetRoom = await validateRoom();
        //Join current user to room on click
        getSocket(updatedUser).join(targetRoom);
        updatedUser.current_room = targetRoom
        updatedUser.save()
        const foundRoom = await Room.findOne({ room_name: targetRoom });
        socket.emit("targetRoom", targetRoom, foundRoom.messages);
      }, 200);
    });


    socket.on("Message", async (msg, targetRoom, author) => {
      io.to(targetRoom).emit("renderMessage", formatMessage(msg), author, targetRoom);
      const foundRoom = await Room.findOne({ room_name: targetRoom });
      const newMessage = await new Message({
        author,
        body: msg,
        time: moment().format("H:mm"),
      });
      //-----------------------------------
      //Split other user from current user of room
      const otherUser = targetRoom
        .split("-")
        .filter((e) => e !== author)
        .pop();
      //Find other user
      const foundUser = await User.findOne({ username: otherUser });
      //If user already has notifications do this
      if (!getSocket(foundUser).rooms.has(targetRoom)) {
        if (foundUser.notifications) {
          foundUser.notifications.forEach((notification) => {
            if (notification.from_room.includes(targetRoom)) {
              notification.count += 1;
              foundUser.save();
            }
          });
        }
        //Else
        if (!foundUser.notifications.length) {
          const notification = await new Notification({
            from_room: targetRoom,
            count: 1,
          });
          foundUser.notifications.push(notification);
          foundUser.save();
        }
      }
      //Emit messageUpdate to both clients that are in the room
      io.emit("messageUpdate", newMessage, targetRoom);
      //Emit to client of user on the other end
      socket.broadcast.to(foundUser.socket_id).emit("refreshRooms", targetRoom);
      socket.emit("refreshRooms", targetRoom);
      setTimeout(() => {
        socket.broadcast.to(foundUser.socket_id).emit("renderNotifications", foundUser.notifications);
      }, 300)
      newMessage.save();
      foundRoom.messages.push(newMessage);
      foundRoom.save();
    });


    socket.on("searchUser", async (searchValue) => {
      const foundUser = await User.findOne({ username: searchValue });
      socket.emit("foundUser", foundUser);
    });


    socket.on("addUser", async (clickedUser) => {
      async function addToContacts(user1, user2) {
        const foundUser = await User.findOne({ username: user1 });
        foundUser.contacts_list.push(user2);
        foundUser.save();
      }
      await addToContacts(currentUser, clickedUser);
      await addToContacts(clickedUser, currentUser);
    });


    socket.on("findContacts", async () => {
      const foundUser = await User.findOne({ username: currentUser })
      const contacts = []
      for (let username of foundUser.contacts_list) {
        const foundContact = await User.findOne({ username })
        const contactInfo = {
          name: foundContact.name,
          username: foundContact.username,
          about: foundContact.about,
          pictureURL: foundContact.profile_picture.path
        }
        contacts.push(contactInfo)
      }
      socket.emit("renderContacts", contacts)
    })

    socket.on('updateUser', async (value, target) => {
      user[target] = value
      user.save()
    })
  });
});
//Server listener
const port = process.env.PORT || 3000
server.listen(port, () => {
  console.log(`Listening on port ${port} !`);
});
