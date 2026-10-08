// flows-auth-order-1 positive: the validation middleware is registered before the auth middleware, so this file MUST fire.
import express from 'express';
import { validateRequest } from './middleware/validate';
import { authenticate } from './middleware/authenticate';
import { ordersRouter } from './routes/orders';

const app = express();
app.use(express.json());
app.use(validateRequest);
app.use(authenticate);
app.use('/orders', ordersRouter);

export default app;
