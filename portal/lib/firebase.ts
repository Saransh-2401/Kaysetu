import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
    apiKey: "AIzaSyDeE9S1je2ERLk0HNVOnXps_y8DT0AaqSQ",
    authDomain: "salexa-5aef9.firebaseapp.com",
    projectId: "salexa-5aef9",
    storageBucket: "salexa-5aef9.firebasestorage.app",
    messagingSenderId: "210360336322",
    appId: "1:210360336322:web:5268bd2b6decba7b6ee05b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Messaging
export const messaging = typeof window !== "undefined" ? getMessaging(app) : null;

export const requestForToken = async () => {
    if (!messaging) return null;

    try {
        const currentToken = await getToken(messaging, {
            vapidKey: "BFW84WNC2wmjEb7D2jvBGtbZF_aW1Qt1spHlECKWSEKBwOGAFDJYf_4DnkftBWtKNUmZOYLisA1VhE_Y845w5v4"
        });
        if (currentToken) {
            console.log('Firebase current token for client: ', currentToken);
            return currentToken;
        } else {
            console.log('No registration token available. Request permission to generate one.');
        }
    } catch (err) {
        console.log('An error occurred while retrieving token. ', err);
    }
    return null;
};

export const onMessageListener = () =>
    new Promise((resolve) => {
        if (!messaging) return;
        onMessage(messaging, (payload) => {
            console.log("Message received: ", payload);
            resolve(payload);
        });
    });

export default app;
