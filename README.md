# google_meet_clone

Google Meet Clone is a website where you can organize your meetings / video calls quick and fast. It has following features:

1. Group Video Calls
2. Group chat
3. Screen Sharing
4. Collaborative whiteboard
5. Google Authentication 

## Tools / Technologies Used

### Front End:

html, css , javascript, tailwind css

### Back End:

node js, express

### Others:

socket.io, webrtc

## Installation

Install node js, clone this repository, then use the package manager [npm](https://www.npmjs.com/package/npm) to install dependencies.

```bash
npm install
```

Create a .env file and set the following environment variables:

PORT=*<Port Number>*  
JWT_SECRET_KEY=*<Secret Key to Sign JSON WEB TOKEN, You can generate it randomly>*  
CLIENT_ID=*<Google OAuth 2.0 client Id. [click here](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid#get_your_google_api_client_id) to know how to get your client id>*

## Usage
  
To start the server :  
  
```bash
npm start
```

## Contributing
Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.
