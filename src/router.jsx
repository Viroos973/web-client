import { createBrowserRouter} from 'react-router-dom';
import {ROUTES} from "./const/route.js";
import Root from "./pages/Root"
import Tables from "./pages/Tables.jsx";

export const router = createBrowserRouter([
    {
        path: ROUTES.ROOT,
        element: <Root />
    },
    {
        path: ROUTES.TABLES,
        element: <Tables />
    }
])