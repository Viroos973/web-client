import axios from "axios";
import {useEffect, useState} from "react";

const Root = () => {
    const [rooms, setRooms] = useState(null)
    const [update, setUpdate] = useState(false)

    useEffect(() => {
        const getAllRooms = async () => {
            const rooms = await axios.get(`http://158.160.147.53:6868/rooms/getUserRooms`, {
                headers: {
                    "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
                }
            })
            setRooms(rooms.data.my_rooms)
        }

        getAllRooms()
    }, [update])

    const addRoom = async() => {
        const name = document.getElementById('7777777').value
        await axios.post("http://158.160.147.53:6868/rooms/addRoom", {name: name}, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("x-auth-token")}`
            }
        })
            .then(data => {
                setUpdate(prev => !prev)
                window.location.pathname = `/room/${data.data.roomId}/table/${data.data.tableId}`
            })
    }

    const joinRoom = async() => {
        const code = document.getElementById('55555').value
        await axios.post("http://158.160.147.53:6868/rooms/inviteUser", {invitation_code: code}, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("x-auth-token")}`
            }
        })
            .then(data => {
                setUpdate(prev => !prev)
                window.location.pathname = `/room/${data.data.roomId}/table/${data.data.tableId}`
            })
    }

    return (
        <>
            <button onClick={addRoom}>Add Room</button>
            <input type={'text'} id={'7777777'}/><br/>
            <button onClick={joinRoom}>Join Room</button>
            <input type={'text'} id={'55555'}/><br/>
            <ul>
                {rooms == null ? "" : rooms.map((item) => (
                    <li key={item._id}><a href={`/room/${item._id}/table/${item.main_table}`}>{item.name}</a></li>
                ))}
            </ul>
        </>
    )
}

export default Root