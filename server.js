const express = require("express");
const Razorpay = require("razorpay");
const bodyParser = require("body-parser");
const cors = require("cors");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ---------------- MONGO CONNECTION ----------------
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB Connected Successfully"))
.catch((err) => console.log("❌ MongoDB Connection Error:", err));

// ---------------- BOOKING SCHEMA ----------------
const bookingSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    amount: Number,
    paymentId: String,
    status: {
        type: String,
        enum: ["PENDING", "SUCCESS", "FAILED"],
        default: "PENDING"
    },
    createdAt: { type: Date, default: Date.now }
});

const Booking = mongoose.model("Booking", bookingSchema);

// ---------------- RAZORPAY SETUP ----------------
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// ---------------- CREATE ORDER ----------------
app.post("/create-order", async (req, res) => {
    const { amount, name, email, phone } = req.body;

    const options = {
        amount: amount * 100, // convert to paise
        currency: "INR",
        receipt: "receipt_order_" + Date.now(),
    };

    try {
        const order = await razorpay.orders.create(options);

        // Save booking with PENDING status
        const booking = new Booking({
            name,
            email,
            phone,
            amount,
            paymentId: order.id,
            status: "PENDING"
        });
        await booking.save();

        res.json(order);
    } catch (err) {
        console.error("❌ Error creating order:", err);
        res.status(500).send("Error creating order");
    }
});

// ---------------- VERIFY PAYMENT ----------------
app.post("/verify-payment", async (req, res) => {
    const { paymentId, status } = req.body;

    try {
        await Booking.findOneAndUpdate(
            { paymentId },
            { status: status || "SUCCESS" }
        );
        res.send("✅ Payment status updated");
    } catch (err) {
        console.error("❌ Error verifying payment:", err);
        res.status(500).send("Error verifying payment");
    }
});

// ---------------- START SERVER ----------------
app.listen(8080, () => console.log("🚀 Server running on port 8080"));
