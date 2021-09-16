let users = ''
setTimeout(() => {
    users = document.querySelectorAll('.user')
    if (users) {
        for (let user of users) {
            user.addEventListener('click', async (e) => {
                toggleDisplay(chatContainer, defaultWindow)
                const clickedUser = e.currentTarget.dataset.username
                const clickedRoom = e.currentTarget.dataset.roomname
                const userData = { clickedUser, currentUser }
                socket.emit('renderUser', clickedUser)
                socket.emit('createRoom', userData)
                socket.emit('focusRoom', userData, clickedRoom)
                toggleDisplay(contactsDiv, chatMenu)
                messageContainer.innerHTML = ''
            })
        }
    }
}, 500)
const chatForm = document.getElementById('chat-form')
const messageContainer = document.querySelector('.message-container')
const chatContainer = document.querySelector('.chat-container')
const defaultWindow = document.querySelector('.default-window')
const chatMain = document.querySelector('.chatmain')
const textInput = document.getElementById('textInput')
const chatNavbar = document.querySelector('.chat-navbar .navbar-collapse')
const searchUserForm = document.getElementById('search-user-form')
const addUserButton = document.querySelector('add-button')
const socket = io()
//Send user data to server on log-in
const currentUser = window.currentUser
const currentUserContacts = window.currentUserContacts

socket.emit('newConnection', currentUser)

socket.on('renderRooms', roomData => {
    roomData.forEach(data => {
        const div = document.createElement('div')
        div.classList.add('user')
        div.setAttribute('data-username', data.username)
        div.setAttribute('data-roomname', data.roomName)
        div.innerHTML =
            `
                             <div class="user-profile-picture ms-3">
                                 <img src="${data.profilePicture}" alt="">
                             </div>
                             <div class="ms-3">
                                 <div class="name">
                                     ${data.name}
                                 </div>
                                 <div class="about">
                                     ${data.lastMessage?.body ?? data.about}
                                 </div>
                             </div>
                             <div class="ms-auto me-3 notifications">
                                 <div class="last-msg-time">
                                     ${data.lastMessage?.time ?? ``} 
                                 </div>
                             </div>`
        document.querySelector('.contacts-main').appendChild(div)
        /*         <div class="chat-notification-container mt-1 d-flex justify-content-end">
                                           <div class="chat-notification">
                                             <div class="msg-count">
                                               1
                                             </div>
                                           </div>
                                         </div> */
    })
})
socket.on('renderNotifications', notifications => {
    for (let notification of notifications) {
        for (let user of users) {
            if (user.dataset.roomname === notification.from_room) {
                const div = document.createElement('div')
                div.classList.add('chat-notification-container', 'mt-1', 'd-flex', 'justify-content-end')
                div.innerHTML = `<div class="chat-notification">
                <div class="msg-count">
                  ${notification.count}
                </div>
              </div>`
                user.getElementsByClassName('notifications')[0].appendChild(div)
            }
        }
    }
})

socket.on('resetNotifications', room => {
    users.forEach(user => {
        if (user.dataset.roomname === room) {
            user.getElementsByClassName('chat-notification-container')[0].remove()
        }
    })
})
searchUserForm.addEventListener('submit', (e) => {
    e.preventDefault()
    const searchValue = e.target.elements.searchUsers.value
    socket.emit('searchUser', searchValue)
})
socket.on('foundUser', user => {
    const div = document.createElement('div')
    div.classList.add('user')
    div.innerHTML =
        `<div class="user-profile-picture d-flex ms-3">
        <img src="${user.profile_picture.path}" alt="">
    </div>
    <div class="ms-3">
        <div class="name">
            ${user.name}
        </div>
        <div class="about">
            ${user.about}
        </div>
    </div>`
    console.log(currentUserContacts)
    if (currentUserContacts.includes(user.username)) {
        div.innerHTML += `<div class="user-plus-icon ms-auto me-3">
            <button disabled
                class="user-check"><i class="fas fa-user-check fa-lg"></i>
            </button>
        </div>`
    } else {
        div.innerHTML += `<div class="user-plus-icon ms-auto me-3">
            <button data-username="${user.username}"
                class="add-button"><i class="fas fa-plus-circle fa-lg"></i>
            </button>
        </div>`
    }
    document.querySelector('.add-menu').appendChild(div)
    const addUserButton = document.querySelector('.add-button')
    addUserButton.addEventListener('click', (e) => {
        const username = e.currentTarget.dataset.username
        socket.emit('addUser', currentUser, username)
    })
})

//Toggle display function
function toggleDisplay(hidden, visible) {
    hidden.classList.replace('hidden', 'visible')
    visible.classList.replace('visible', 'hidden')
}
//Message from server
//Start chat with another user & send clicked user data to render



function renderUser(user) {
    const div = document.createElement('div')
    div.classList.add('navbar-nav', 'ms-auto', 'contact-render-chat-container', 'me-3')
    div.innerHTML = `<div class="contact-render my-auto me-3">
    <div class="name text-end">${user.name}</div>
    <div class="last-seen">Last seen today at 22:18</div>
</div>
<div class="nav-link profilepicture my-auto"
    style="background-image: url('${user.profile_picture.path}');">
</div>`
    chatNavbar.appendChild(div)
}

//Render user in template
socket.on('renderedUser', (user) => {
    const previousRenderedContainer = document.querySelector('.contact-render-chat-container')
    previousRenderedContainer ? previousRenderedContainer.remove() : null
    renderUser(user)
})


//Messaging logic
socket.on('message', (message, author) => {
    if (message && message.text) {
        function outputMessage(message, author) {
            const div = document.createElement('div')
            div.classList.add('msg-container', 'msg', 'server')
            div.innerHTML = `<div class="message">${message.text}</div>
            <div class="time">${message.time}</div>`
            messageContainer.appendChild(div)
            if (author === currentUser) {
                div.classList.replace('server', 'client')
            }
            chatMain.scrollTop = chatMain.scrollHeight
        }
        outputMessage(message, author)
    }
})

socket.on('messageUpdate', (msg, targetRoom) => {
    for (let user of users) {
        if (user.dataset.roomname === targetRoom) {
            user.getElementsByClassName('about')[0].innerText = msg.body
        }
    }
})

//Emit message to server
chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const targetRoom = messageContainer.getAttribute('data-roomname')
    const msg = e.target.elements.textInput.value
    socket.emit('Message', msg, targetRoom, currentUser)
    //Clear text input
    e.target.elements.textInput.value = ""
    e.target.elements.textInput.focus()
})

socket.on('targetRoom', (targetRoom, messages) => {
    //Assign room-name in DOM for targeting messages
    messageContainer.setAttribute('data-roomname', targetRoom);
    //Fetch and render messages from mongo
    for (let msg of messages) {
        function outputMessage(body, author, time) {
            const div = document.createElement('div')
            div.classList.add('msg-container', 'msg', 'server')
            div.innerHTML = `<div class="message">${body}</div>
            <div class="time">${time}</div>`
            messageContainer.appendChild(div)
            if (author === currentUser) {
                div.classList.replace('server', 'client')
            }
            chatMain.scrollTop = chatMain.scrollHeight
        }
        outputMessage(msg.body, msg.author, msg.time)
    }
})