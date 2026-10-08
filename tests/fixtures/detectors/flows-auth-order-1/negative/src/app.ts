// flows-auth-order-1 negative: auth is registered BEFORE validation, so it must NOT fire; a naive order-insensitive `validate` + `auth` co-occurrence scan would flag it.
import express from 'express';
import { authenticate } from './middleware/authenticate';
import { validateRequest } from './middleware/validate';
import { ordersRouter } from './routes/orders';

const app = express();
app.use(express.json());
app.use(authenticate);
app.use(validateRequest);
app.use('/orders', ordersRouter);

export default app;
