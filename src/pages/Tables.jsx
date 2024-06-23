import { useCallback, useEffect, useState } from "react"
import { io } from "socket.io-client"
import { useParams } from "react-router-dom"
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';
import axios from "axios";

const SAVE_INTERVAL_MS = 2000

let myColumns = [
    {
        data: '0',
        type: 'text'
    }
]

const findCell = (col, row) => {
    const elementsInRange = document.querySelectorAll(`[aria-colindex="${col + 2}"]`)

    const filteredElements = Array.from(elementsInRange).filter(elem =>
        elem.parentElement?.getAttribute('aria-rowindex') == row + 2
    )

    return filteredElements[0]
}

const Tables = () => {
    const { roomId, tableId } = useParams()
    const [socket, setSocket] = useState()
    const [table, setTable] = useState()
    const [allTables, setAllTables] = useState(null)
    const [dataTable, setDataTable] = useState(["Loading..."])
    const [users, setUsers] = useState(null)
    const [userId, setUserId] = useState(null)
    const [tableName, setTableName] = useState(null)
    const [room, setRoom] = useState(null)
    const [update, setUpdate] = useState(false)

    let editUser = true
    let rowAndCol = null

    useEffect(() => {
        const s = io("http://158.160.147.53:6969", {
            extraHeaders: {
                "x-auth-token": localStorage.getItem("x-auth-token"),
                "Authorization": localStorage.getItem("x-auth-token")
            }
        })
        setSocket(s)

        setDataTable([
            "English",
            "I'm a hero",
            "I'm a villain",
            "I'm a boy",
            "I'm a girl",
            "I'm a man",
            "I'm a women",
            "I'm a cat",
            "I'm a dog",
            "I'm a bird",
            "I'm a animal"
        ])
        setUsers([
            {id: 1},
            {id: 2},
            {id: 3},
            {id: 4},
            {id: 5}
        ])
        setUserId(1)

        return () => {
            s.disconnect()
        }
    }, [])

    useEffect(() => {
        async function fetchData() {
            try {
                const roomResponse = await axios.get(`http://158.160.147.53:6868/rooms/getRoom?roomId=${roomId}`, {
                    headers: {
                        "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
                    }
                });
                setRoom(roomResponse.data);

                const tablesResponse = await axios.get(`http://158.160.147.53:6868/rooms/getTables?roomId=${roomId}`, {
                    headers: {
                        "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
                    }
                });
                setAllTables(tablesResponse.data.tables);
            } catch (error) {
                console.error("Error fetching data:", error);
            }
        }

        fetchData();
    }, [update])

    useEffect(() => {
        if (socket == null || table == null || dataTable[0] === "Loading..." || users == null || userId == null) return

        socket.once("load-document", (tableExist, data, columns, name) => {
            if (!tableExist) return

            if (data === null) {
                table.loadData(dataTable.map(items => ({0: items})))
            } else {
                table.loadData(data)
                myColumns = columns
            }

            setTableName(name)

            table.updateSettings({
                columns: myColumns
            })

            rowAndCol = users.map((item) => ({id: item.id, row: null, col: null}))
        })

        socket.emit("get-document", tableId, roomId)
    }, [socket, table, tableId, dataTable, users, userId])

    useEffect(() => {
        if (socket == null || table == null) return

        const interval = setInterval(() => {
            socket.emit("save-document", table.getSourceData(), myColumns)
        }, SAVE_INTERVAL_MS)

        return () => {
            clearInterval(interval)
        }
    }, [socket, table])

    useEffect(() => {
        if (socket == null || table == null) return

        const handler = delta => {
            editUser = false
            table.setDataAtCell(delta[0], delta[1], delta[2])
        }
        socket.on("receive-changes", handler)

        return () => {
            socket.off("receive-changes", handler)
        }
    }, [socket, table])

    useEffect(() => {
        if (socket == null || table == null) return

        const handler = (changes, source) => {
            if (source !== "edit") return

            rowAndCol.map((item) => {
                if (item.col == null || item.row == null) return

                const filteredElements = findCell(item.col, item.row)
                filteredElements.classList.add('cell-with-custom-border')
            })

            if (!editUser) {
                editUser = true
                return
            }

            socket.emit("send-changes", [changes[0][0], table.propToCol(changes[0][1]), changes[0][3]])
        }
        table.addHook('afterChange', handler)

        return () => {
            Handsontable.hooks.remove('afterChange', handler);
        }
    }, [socket, table])

    useEffect(() => {
        if (socket == null || table == null) return

        const handler = (row, col, id) => {
            const otherUser = rowAndCol.find((item) => item.id === id)

            if (otherUser.row !== null && otherUser.col !== null) {
                const oldElements = findCell(otherUser.col, otherUser.row)
                oldElements.classList.remove('cell-with-custom-border')
            }

            const filteredElements = findCell(col, row)
            filteredElements.classList.add('cell-with-custom-border')

            otherUser.col = col
            otherUser.row = row
        }
        socket.on("set-color", handler)

        return () => {
            socket.off("set-color", handler)
        }
    }, [socket, table])

    useEffect(() => {
        if (socket == null || table == null) return

        const handler = (row, col) => {
            socket.emit("click-mouse", row, col, userId)
        }

        table.addHook('afterSelection', handler)

        return () => {
            Handsontable.hooks.remove('afterSelection', handler);
        }
    }, [socket, table])

    useEffect(() => {
        if (socket == null || table == null) return

        const handler = (id) => {
            const otherUser = rowAndCol.find((item) => item.id === id)

            if (otherUser.row !== null && otherUser.col !== null) {
                const oldElements = findCell(otherUser.col, otherUser.row)
                oldElements.classList.remove('cell-with-custom-border')
            }

            otherUser.col = null
            otherUser.row = null
        }
        socket.on("delete-color", handler)

        return () => {
            socket.off("delete-color", handler)
        }
    }, [socket, table])

    useEffect(() => {
        if (socket == null || table == null) return

        const handler = () => {
            socket.emit("no-click-mouse", userId)
        }

        table.addHook('afterDeselect', handler)

        return () => {
            Handsontable.hooks.remove('afterDeselect', handler);
        }
    }, [socket, table])

    useEffect(() => {
        if (socket == null || table == null) return

        const handler = (cols, title) => {
            myColumns = cols
            table.setDataAtCell(0, myColumns.length - 1, title)
            table.updateSettings({
                columns: myColumns
            })
        }
        socket.on("receive-cols", handler)

        return () => {
            socket.off("receive-cols", handler)
        }
    }, [socket, table])

    const addColumn = () => {
        const title = document.getElementById('999999999').value
        myColumns.push({});

        table.setDataAtCell(0, myColumns.length - 1, title)
        table.updateSettings({
            columns: myColumns
        })

        socket.emit("send-cols", myColumns, title)
    }

    const addTable = async () => {
        const name = document.getElementById('333').value
        await axios.post(`http://158.160.147.53:6868/tables/addTable?roomId=${roomId}`, {name: name}, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
            }
        })
            .then(table => {
                window.location.pathname = `/room/${roomId}/table/${table.data.tableId}`
            })
    }

    const renameTable = async () => {
        const name = document.getElementById('1').value
        await axios.put(`http://158.160.147.53:6868/tables/renameTable?tableId=${tableId}`, {name: name}, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
            }
        })
            .then(() => {
                setTableName(name)
            })
    }

    const renameRoom = async () => {
        const name = document.getElementById('22').value
        await axios.put(`http://158.160.147.53:6868/rooms/renameRoom?roomId=${roomId}`, {name: name}, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
            }
        })
            .then(() => {
                setUpdate(prev => !prev)
            })
    }

    const wrapperRef = useCallback(wrapper => {
        if (wrapper == null) return

        wrapper.innerHTML = ""
        const editor = document.createElement("div")
        wrapper.append(editor)
        const t = new Handsontable(editor, {
            data: [
                dataTable
            ],
            colHeaders: true,
            rowHeaders: true,
            autoRowSize: true,
            trimWhitespace: false,
            fixedRowsTop: 1
        })

        setTable(t)
    }, [])
    return (
        <>
            <h1>Room name: {room == null ? "" : room.name}</h1>
            <h3>Table name: {tableName}</h3>
            <div className="container" ref={wrapperRef}/>
            <button onClick={addColumn}>Add Column</button>
            <input type={'text'} id={'999999999'}/><br/>
            <button onClick={addTable}>Add Table</button>
            <input type={'text'} id={'333'}/><br/>
            <ul id="cars">
                {allTables != null ? allTables.map((item) => (
                    <li key={item.id}><a href={item.id}>{item.name}</a></li>
                        )) : ""}
            </ul><br/>
            <button onClick={renameTable}>Rename Table</button>
            <input type={'text'} id={'1'}/><br/>
            <button onClick={renameRoom}>Rename Room</button>
            <input type={'text'} id={'22'}/><br/>
        </>
    )
}

export default Tables