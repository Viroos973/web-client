import axios from "axios";
import {useEffect, useState} from "react";

const parseJsonFile = (json) => {
    return json.map((item) => {
        item.columns.unshift(item.labels)
        if (item.useAttributes) item.columns.push(item.attributes)

        const transformedArray = item.columns.reduce((acc, curr, index) => {
            curr.forEach((value, key) => {
                if (!acc[key]) {
                    acc[key] = {};
                }
                acc[key][index] = value;
            });
            return acc;
        }, []);

        const arr = new Array(item.columns.length).fill({})

        return {
            fileName: item.fileName.split(".")[0],
            version: item.version,
            isBigEndian: item.isBigEndian,
            useIndices: item.useIndices,
            useStyles: item.useStyles,
            useAttributes: item.useAttributes,
            useAttributeStrings: item.useAttributeStrings,
            bytesPerAttribute: item.bytesPerAttribute,
            atO1Numbers: item.atO1Numbers,
            encoding: item.encoding,
            attributes: item.attributes,
            data: transformedArray,
            columns: arr
        }
    })
}

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
        const fileInput = document.getElementById('88888888')
        const file = fileInput.files[0]
        let formData = new FormData();
        formData.append("zipWithMsbts", file);

        await axios.post("http://158.160.147.53:2223/api/msbt/zipToSheets", formData, {
            headers: {
                "Content-Type": "multipart/form-data",
            }
        })
            .then(async (fileStr) => {
                const tables = parseJsonFile(fileStr.data)

                await axios.post("http://158.160.147.53:6868/rooms/addRoom", {name: name, tableData: tables[0]}, {
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem("x-auth-token")}`
                    }
                })
                    .then((data) => {
                        setUpdate(prev => !prev)

                        tables.shift()
                        Promise.all(tables.map((item) => {
                            return axios.post(`http://158.160.147.53:6868/tables/addTable?roomId=${data.data.roomId}`,
                                { tableData: item }, {
                                headers: {
                                    'Authorization': `Bearer ${localStorage.getItem("x-auth-token")}`
                                }
                            }).then(() => {
                                console.log("+")
                            })
                        })).then(() => {
                            window.location.pathname = `/room/${data.data.roomId}/table/${data.data.tableId}`
                        })
                    })
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
            <input type={'text'} id={'7777777'}/>
            <input type="file" id="88888888" name="file"/><br/>
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