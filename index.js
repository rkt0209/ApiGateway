const express = require('express');
const morgan = require('morgan');
const {createProxyMiddleware} = require('http-proxy-middleware')
const  rateLimit = require('express-rate-limit');
const axios = require('axios');
const app = express();
const PORT = 3005;
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 1000
})
app.set('trust proxy', 1);
app.use(morgan('combined'));
app.use(limiter);

// Middleware to authenticate the user before accessing bokking service
app.use('/bookingservice',async(req,res,next)=>{
   try {
        const  response = await axios.get('http://localhost:7000/authservice/api/v1/isauthenticated',{
            headers:{
                "x-access-token":req.headers['x-access-token']
            }
        });
        if(response.data.success){
            next();
        }else{
            return res.status(401).json({
                message:"Unauthorised user"
            })
        }
   } catch (error) {
     return res.status(401).json({
        message:"Unauthorised user"
     })
   } 
})

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