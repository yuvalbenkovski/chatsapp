if (process.env.NODE_ENV === "production") {
  console.log("Running in production");
} else {
  console.log("Running in development");
  require("dotenv").config();
}

const express = require("express");
const http = require("http");
const app = express();
const server = http.createServer(app);
const socketio = require("socket.io");
const io = socketio(server);
const { formatMessage } = require("./utils/messages");
const mongoose = require("mongoose");
const session = require("express-session");
const sessionConfig = {
  secret: "secret",
  saveUninitialized: true,
  resave: true,
  /*     cookie: {
            maxAge: 6000000
        } */
};
const sessionMiddleware = session(sessionConfig);

io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

io.on("connection", (socket) => {
  //List of all current sockets
  const clients = [];
  io.sockets.sockets.forEach(function (data) {
    clients.push(data.id);
  });
  /*     console.log(clients) */
  socket.on("newConnection", async (currentUser) => {
    //Link socket id to current logged in user and store in database
    const user = await User.findOneAndUpdate(
      { username: currentUser },
      { socket_id: socket.id },
      { new: true }
    );
    /*                 user.rooms = undefined */
    /*         user.notifications = undefined
                await user.save() */
    //Render active rooms
    const roomData = [];
    if (user.rooms) {
      for (let room of user.rooms) {
        io.sockets.sockets.get(user.socket_id).join(room);
        const foundRoom = await Room.findOne({ room_name: room });
        /*                 console.log(foundRoom) */
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
        };
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
    //Render notifications
    setTimeout(() => {
      if (user.notifications) {
        socket.emit("renderNotifications", user.notifications);
      }
    }, 1000);
    /*         console.log(users) */
    /*         console.log(io.sockets.adapter.rooms) */
  });
  socket.on("createRoom", async (userData) => {
    const { currentUser, clickedUser } = userData;
    const currentUserData = await User.findOne({ username: currentUser });
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
            user.save();
          });
        };
        //Execute
        addToUsers([currentUserData, clickedUserData], roomName);
        //Return socket object of a user
        const getSocket = function (userData) {
          return io.sockets.sockets.get(userData.socket_id);
        };
        //Join both users to room (Works only once unless the room doesn't exist.)
        getSocket(currentUserData).join(roomName);
        /*                 if (clients.includes(clickedUserData.socket_id)) {
                                    getSocket(clickedUserData).join(roomName)
                                } */
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
  socket.on("focusRoom", async (users, room) => {
    setTimeout(async () => {
      const { currentUser, clickedUser } = users;
      //----------
      /*             console.log(room) */
      const foundUser = await User.findOne({ username: currentUser });
      if (foundUser.notifications) {
        for (let notification of foundUser.notifications) {
          if (notification.from_room === room) {
            foundUser.notifications.id(notification._id).remove();
            foundUser.save();
            socket.emit("resetNotifications", room);
          }
        }
      }
      //----------
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
      const foundRoom = await Room.findOne({ room_name: targetRoom });
      socket.emit("targetRoom", targetRoom, foundRoom.messages);
    }, 100);
  });
  socket.on("Message", async (msg, targetRoom, author) => {
    io.to(targetRoom).emit("message", formatMessage(msg), author);
    const foundRoom = await Room.findOne({ room_name: targetRoom });
    const newMessage = await new Message({
      author,
      body: msg,
      time: moment().format("H:mm"),
    });
    //-----------------------------------
    const otherUser = targetRoom
      .split("-")
      .filter((e) => e !== author)
      .pop();
    const foundUser = await User.findOne({ username: otherUser });
    const foundUserSocket = io.sockets.sockets.get(foundUser.socket_id);
    if (!foundUserSocket || !foundUserSocket.rooms.has(targetRoom)) {
      if (foundUser.notifications) {
        foundUser.notifications.forEach((notification) => {
          if (notification.from_room.includes(targetRoom)) {
            notification.count += 1;
            foundUser.save();
          }
        });
      }
      if (!foundUser.notifications.length) {
        const notification = await new Notification({
          from_room: targetRoom,
          count: 1,
        });
        foundUser.notifications.push(notification);
        foundUser.save();
      }

      console.log(foundUser);
    } else {
      console.log("Both users are in room.");
    }
    socket.emit("messageUpdate", newMessage, targetRoom);
    newMessage.save();
    foundRoom.messages.push(newMessage);
    foundRoom.save();
  });
  socket.on("searchUser", async (user) => {
    const foundUser = await User.findOne({ username: user });
    socket.emit("foundUser", foundUser);
  });
  socket.on("addUser", async (currentUser, user) => {
    async function addToContacts(user1, user2) {
      const foundUser = await User.findOne({ username: user1 });
      foundUser.contacts_list.push(user2);
      foundUser.save();
    }
    await addToContacts(currentUser, user);
    await addToContacts(user, currentUser);
  });
});
const moment = require("moment");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const { User, Notification } = require("./models/user");
const { Room, Message } = require("./models/room");
const multer = require("multer");
const { storage } = require("./cloudinary");
const upload = multer({ storage });
const flash = require("connect-flash");
const path = require("path");
//------------
mongoose.connect("mongodb://localhost:27017/chats-app", {
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
//------------

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({ extended: true }));
app.use(flash());
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

//--------Middleware-------
app.use((req, res, next) => {
  res.locals.currentUser = req.user;
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

const isLoggedIn = (req, res, next) => {
  if (!req.session) {
    req.flash("error", "You must sign in first");
    res.redirect("/login");
  } else {
    next();
  }
};
//-------------------------

/* app.get('/', (req, res) => {
    res.render('index')
}) */

app.get("/", async (req, res) => {
  if (!req.user) {
    res.render("landingpage");
  } else {
    const contacts = [];
    for (let contact of req.user.contacts_list) {
      const foundUser = await User.findOne({ username: contact });
      contacts.push(foundUser);
    }
    res.render("index", { contacts });
  }
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", upload.single("inpFile"), async (req, res) => {
  const { username, password, email, name, passwordConfirm } = req.body;
  if (password === passwordConfirm) {
    const user = new User({ username, email, name });
    user.profile_picture.path = req.file.path;
    const registeredUser = await User.register(user, password);
    req.login(registeredUser, function (err) {
      if (err) {
        console.log(err);
      } else {
        res.redirect("/");
      }
    });
  } else {
    res.send("Password does not match!");
  }
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post(
  "/login",
  passport.authenticate("local", {
    failureRedirect: "/login",
    failureFlash: true,
  }),
  (req, res) => {
    res.redirect("/");
  }
);

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

const port = 3000 || process.env.PORT;
server.listen(port, () => {
  console.log(`Listening on port ${port} !`);
});
