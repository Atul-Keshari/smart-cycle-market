import { connect } from "mongoose";

const uri = "mongodb://127.0.0.1:27017/smartcyclemarket";

connect(uri).then(
        () => console.log("Connected to MongoDB"),
).catch(
    (error) => console.log("db connection error: ",error.message)
);