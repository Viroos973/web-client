import { createBrowserRouter, Navigate } from 'react-router-dom';
import {ROUTES} from "./const/route.js";
import Root from "./pages/Root"
import { v4 as uuidV4 } from "uuid"

export const router = createBrowserRouter([
    {
        path: ROUTES.ROOT,
        element: <Navigate to={`/documents/${uuidV4()}`} replace/>
    },
    {
        path: ROUTES.TABLES,
        element: <Root />
    }
])