import { useState } from 'react'
import './App.css'
import {RouterProvider} from "react-router-dom";
import {router} from "./router.jsx";

export const App = () => (
    <RouterProvider router={router} />
)