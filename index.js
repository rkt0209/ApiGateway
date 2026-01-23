const express = require('express');
const morgan = require('morgan');
const {createProxyMiddleware} = require('http-proxy-middleware')
const  rateLimit = require('express-rate-limit');

const app = express();
const PORT = 3005;
const limiter = rateLimit({
    windowMs:2 * 60 * 1000,
    max: 5
})
app.set('trust proxy', 1);
app.use(morgan('combined'));
app.use(limiter);

app.use('/bookingservice',
  createProxyMiddleware({
    target: 'http://localhost:5000/bookingservice',
    changeOrigin: true,
    
  })
);

app.use('/flightservice',
  createProxyMiddleware({
    target: 'http://localhost:3000/flightservice',
    changeOrigin: true,
    
  })
);
app.use('/authservice',
  createProxyMiddleware({
    target: 'http://localhost:7000/authservice',
    changeOrigin: true,
    
  })
);

app.get('/home',(req,res)=>{
    return res.json({
        message:"OK"
    })
})
app.listen(PORT,()=>{
    console.log("server started on port",PORT);
})