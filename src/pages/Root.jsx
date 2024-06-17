import axios from "axios";

const Root = () => {
    const addRoom = async() => {
        const name = document.getElementById('7777777').value
        await axios.post("http://localhost:5000/rooms/addRoom", {name: name}, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem("x-auth-token")}`
            }
        })
            .then(data => {
                window.location.pathname = `/room/${data.data.roomId}/table/${data.data.tableId}`
            })
    }

    return (
        <>
            <button onClick={addRoom}>Add Room</button>
            <input type={'text'} id={'7777777'}/>
        </>
    )
}

export default Root