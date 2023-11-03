const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();
const app = express();
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000;

// middleware
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser())


// middlewares
const logger = (req, res, next) => {
    console.log('called', req.host, req.originalUrl, req.protocol);
    next();
}

const verifyToken = async (req, res, next) => {
    const token = req.cookies?.token;
    // console.log('token in middleware: ', token);
    if(!token){
        return res.status(401).send({message: 'unauthorized access'});
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err){
            console.log(err);
            return res.status(401).send({message: 'unauthorized access'});
        }
        
        req.user = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.slnkkkb.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {

        await client.connect();

        const serviceCollection = client.db("serviceDB").collection("services");
        const bookingCollection = client.db("bookingDB").collection("bookings");


        // auth related api
        app.post('/jwt', logger,  async (req, res) => {
            const user = req.body;
            console.log(user);

            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1hr'});
            res
            .cookie('token', token, {
                httpOnly: true,
                secure: false,
            })
            .send({success: true})
        })

        app.post('/logout', async(req, res) => {
            const user = req.body;
            console.log(user);

            res.clearCookie('token', {maxAge: 0}).send({success: true});
        })


        // services
        app.get('/services', logger, async (req, res) => {
            const cursor = serviceCollection.find();
            const result = await cursor.toArray();

            res.send(result);
        })

        app.get('/services/:id', async (req, res) => {
            const id = req.params.id;

            const query = { _id: new ObjectId(id) };
            const options = {
                projection: { title: 1, img: 1, price: 1 },
            };

            const result = await serviceCollection.findOne(query, options);
            res.send(result);
        })

        // bookings
        app.get('/bookings', logger, verifyToken, async (req, res) => {
            console.log('user in the valid token', req.user);
            console.log(req.query.email);
            if(req.query.email !== req.user.email){
                return res.status(403).send({message: 'forbidden access'});
            }

            let query = {};
            if (req.query?.email) {
                query = { email: req.query.email }
            }

            const result = await bookingCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/bookings', async (req, res) => {
            const booking = req.body;
            console.log(booking);
            const result = await bookingCollection.insertOne(booking);
            res.send(result);
        });

        app.patch('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedBooking = req.body;
            console.log(updatedBooking);
            const updateDoc = {
                $set: {
                    status: updatedBooking.status
                },
            };
            const result = await bookingCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.delete('/bookings/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await bookingCollection.deleteOne(query);
            res.send(result);
        })



        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, res) => {
    res.send('doctor is running')
})

app.listen(port, () => {
    console.log(`Car Doctor Server is running on port ${port}`)
})