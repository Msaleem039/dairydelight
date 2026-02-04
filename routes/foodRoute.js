import express from 'express'
import { addFood, listFood, removeFood } from '../controllers/foodController.js'
import { uploadSingle } from '../middleware/uploadCloudinary.js'

const foodRouter = express.Router();

foodRouter.post('/add', uploadSingle, addFood)
foodRouter.get('/list', listFood)
foodRouter.post('/remove', removeFood)

export default foodRouter;