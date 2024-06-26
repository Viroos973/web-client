import {useCallback, useEffect, useState} from "react"
import {io} from "socket.io-client"
import {useParams} from "react-router-dom"
import Handsontable from 'handsontable';
import 'handsontable/dist/handsontable.full.min.css';
import axios from "axios";
let editUser = true
let myColumns = [
    {
        data: '0',
        type: 'text'
    }
]
let myRow = []

const parseJWT = (token) => {
    if (token == null) return null

    const base64Url = token.split(".")[1]

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')

    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join(''));

    return JSON.parse(jsonPayload)
}

const findCell = (col, row) => {
    const elementsInRange = document.querySelectorAll(`[aria-colindex="${col + 2}"]`)

    const filteredElements = Array.from(elementsInRange).filter(elem =>
        elem.parentElement?.getAttribute('aria-rowindex') == row + 2
    )

    return filteredElements[0]
}
function objectToArray(obj, length) {
    const arr = new Array(length).fill('');
    for (const key in obj) {
        arr[parseInt(key)] = obj[key];
    }
    return arr;
}

const Tables = () => {
    const { roomId, tableId } = useParams()
    const [socket, setSocket] = useState(null)
    const [table, setTable] = useState(null)
    const [allTables, setAllTables] = useState(null)
    const [users, setUsers] = useState(null)
    const [userId, setUserId] = useState(null)
    const [tableName, setTableName] = useState(null)
    const [room, setRoom] = useState(null)
    const [updateTables, setUpdateTables] = useState(false)
    const [updateUsers, setUpdateUsers] = useState(false)
    const [rowAndCol, setRowAndCol] = useState(null)
    const dataTable = ["Loading..."]

    useEffect(() => {
        const s = io("http://158.160.147.53:6969", {
            extraHeaders: {
                "x-auth-token": localStorage.getItem("x-auth-token"),
                "Authorization": localStorage.getItem("x-auth-token")
            }
        })
        setSocket(s)

        const jsonToken = parseJWT(localStorage.getItem("x-auth-token"))
        setUserId(jsonToken == null ? null : jsonToken.userId)

        const getRoom = async () => {
            const roomResponse = await axios.get(`http://158.160.147.53:6868/rooms/getRoom?roomId=${roomId}`, {
                headers: {
                    "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
                }
            })
            setRoom(roomResponse.data)
        }

        getRoom()

        return () => {
            s.disconnect()
        }
    }, [])

    useEffect(() => {
        async function fetchData() {
            const tablesResponse = await axios.get(`http://158.160.147.53:6868/rooms/getTables?roomId=${roomId}`, {
                headers: {
                    "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
                }
            });
            setAllTables(tablesResponse.data.tables);
        }

        fetchData();
    }, [updateTables])

    useEffect(() => {
        const getRoomUsers = async () => {
            const roomResponse = await axios.get(`http://158.160.147.53:6868/rooms/getUsers?roomId=${roomId}`, {
                headers: {
                    "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
                }
            })
            setUsers(roomResponse.data.users)
        }

        getRoomUsers();
    }, [updateUsers])

    useEffect(() => {
        if (socket == null || table == null || users == null || userId == null) return

        socket.once("load-document", (tableExist, data, columns, name) => {
            if (!tableExist) return

            myRow = data
            table.loadData(data)
            myColumns = columns

            setTableName(name)

            table.updateSettings({
                columns: myColumns
            })

            setRowAndCol(users.map((item) => ({id: item._id, row: null, col: null})))
        })

        socket.emit("get-document", tableId, roomId)
    }, [socket, table, tableId, users, userId])

    useEffect(() => {
        if (socket == null || table == null) return

        const handler = delta => {
            editUser = false

            const activeEditor = table.getActiveEditor()
            const value = activeEditor == null ? null : activeEditor.getValue()
            const isOpen = activeEditor == null ? null : activeEditor._opened

            table.setDataAtCell(delta[0], delta[1], delta[2])

            if (activeEditor && isOpen) {
                activeEditor.beginEditing();
                activeEditor.setValue(value)
            }
        }
        socket.on("receive-changes", handler)

        return () => {
            socket.off("receive-changes", handler)
        }
    }, [socket, table])

    useEffect(() => {
        if (socket == null || table == null || rowAndCol == null) return

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
            socket.emit("save-document", table.getSourceData(), myColumns)
        }
        table.addHook('afterChange', handler)

        return () => {
            Handsontable.hooks.remove('afterChange', handler);
        }
    }, [socket, table, rowAndCol])

    useEffect(() => {
        if (socket == null || table == null || rowAndCol == null) return

        const handler = (row, col, id) => {
            const otherUser = rowAndCol.find((item) => item.id === id)

            if (otherUser != null && otherUser.row != null && otherUser.col != null) {
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
    }, [socket, table, rowAndCol])

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

        const handler = (cols, data) => {
            const activeEditor = table.getActiveEditor()
            const value = activeEditor == null ? null : activeEditor.getValue()
            const isOpen = activeEditor == null ? null : activeEditor._opened
            myColumns = cols

            table.updateSettings({
                columns: cols,
                data: data
            })

            if (activeEditor && isOpen) {
                if (activeEditor.col === myColumns.length - 2) activeEditor.col = myColumns.length - 1

                activeEditor.beginEditing();
                activeEditor.setValue(value)
            }
        }
        socket.on("receive-cols", handler)

        return () => {
            socket.off("receive-cols", handler)
        }
    }, [socket, table])

    const addColumn = () => {
        const title = document.getElementById('999999999').value
        myColumns.push({});
        socket.emit("send-cols", myColumns, title)
    }

    const addColumnWithTranslate = async () => {

        myRow = table.getSourceData()
        myRow = myRow.map((item) => {
            const arr = objectToArray(item, myColumns.length)
            arr.splice(arr.length - 1, 0, "")
            return Object.fromEntries(arr.map((value, index) => [index, value]))
        })
        var i;
        var textForTranslate = []
        for (i = 0; i < myRow.length; i++) {
            textForTranslate.push(myRow[i][4])

        }

        const roomResponse = await axios.post(`http://158.160.147.53:6868/translate/translate`, {sourceLanguageCode: "de", folderId: "b1gbi9p05hufm79d5rlo", texts: textForTranslate, targetLanguageCode: document.getElementById("selectlanguage").options[ document.getElementById("selectlanguage").selectedIndex ].value}, {
            headers: {
                "Authorization": "Bearer t1.9euelZqWx8ablp7HlJ6Xy5yXnpuLze3rnpWax56dm4zJy8jHmIvGy87Ki5vl9PdqKhVM-e9dKjiV3fT3KlkSTPnvXSo4lc3n9euelZrOjZOVlZzHnsjGlZaejcjMyu_8xeuelZrOjZOVlZzHnsjGlZaejcjMyg.eBRXiNZiaYbPYY5NHsqmmkDVac15GZF0rcNZZg3Zwzqvuein4foe0ba9OivbfkLAtrS32fVwNJA8YZP0kJsyBQ"
            }

        })
        console.log(roomResponse.data.message.translations)
        let translator = roomResponse.data.message.translations.map(item => item.text);

        console.log(translator);

        myColumns.push({})


    }

    const deleteColumn = () => {
        if(myColumns.length <= 2) return
        myColumns.pop()
        socket.emit("send-cols", myColumns)
    }

    useEffect(() => {
        if (socket == null || table == null) return

        const handler = (rows) => {
            const activeEditor = table.getActiveEditor()
            const value = activeEditor == null ? null : activeEditor.getValue()
            const isOpen = activeEditor == null ? null : activeEditor._opened
            myRow = rows

            table.updateSettings({
                data: rows
            })

            if (activeEditor && isOpen) {
                activeEditor.beginEditing();
                activeEditor.setValue(value)
            }
        }
        socket.on("receive-rows", handler)

        return () => {
            socket.off("receive-rows", handler)
        }
    }, [socket, table])

    const addRow = () => {
        myRow.push({});

        table.updateSettings({
            data: myRow
        })

        socket.emit("send-rows", myRow)
        socket.emit("save-document", table.getSourceData(), myColumns)
    }

    const deleteRow = () => {
        if (myRow.length <= 1) return

        myRow.pop();

        table.updateSettings({
            data: myRow
        })

        socket.emit("send-rows", myRow)
        socket.emit("save-document", table.getSourceData(), myColumns)
    }

    const addTable = async () => {
        const name = document.getElementById('333').value
        const tables = {
            fileName: name,
            data: [table.getSourceData()[0]],
            columns: myColumns
        }
        await axios.post(`http://158.160.147.53:6868/tables/addTable?roomId=${roomId}`, {tableData: tables}, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
            }
        })
            .then(table => {
                socket.emit("send-tables")
                window.location.pathname = `/room/${roomId}/table/${table.data.tableId}`
            })
    }

    const deleteTable = async () => {
        await axios.delete(`http://158.160.147.53:6868/tables/deleteTable?tableId=${tableId}`, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
            }
        })
            .then(() => {
                socket.emit("send-tables", tableId)
                window.location.pathname = `/room/${roomId}/table/${room.main_table}`
            })
    }

    const deleteRoom = async () => {
        await axios.delete(`http://158.160.147.53:6868/rooms/deleteRoom?roomId=${roomId}`, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
            }
        })
            .then(() => {
                window.location.pathname = `/`
            })
    }

    useEffect(() => {
        if (socket == null || table == null) return

        const handler = (name) => {
            setTableName(name)
        }
        socket.on("receive-table-name", handler)

        return () => {
            socket.off("receive-table-name", handler)
        }
    }, [socket, table])

    useEffect(() => {
        if (socket == null || table == null || room == null) return

        const handler = (tableId) => {
            setUpdateTables(prev => !prev)
            if (tableId !== undefined) window.location.pathname = `/room/${roomId}/table/${room.main_table}`
        }
        socket.on("receive-tables", handler)

        return () => {
            socket.off("receive-tables", handler)
        }
    }, [socket, table, room])

    const renameTable = async () => {
        const name = document.getElementById('1').value
        await axios.put(`http://158.160.147.53:6868/tables/renameTable?tableId=${tableId}`, {name: name}, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
            }
        })
            .then(() => {
                setTableName(name)
                setUpdateTables(prev => !prev)
                socket.emit("send-table-name", name)
                socket.emit("send-tables")
            })
    }

    useEffect(() => {
        if (socket == null || table == null || room == null) return

        const handler = (name) => {
            setRoom({...room, name: name})
        }
        socket.on("receive-room-name", handler)

        return () => {
            socket.off("receive-room-name", handler)
        }
    }, [socket, table, room])

    const renameRoom = async () => {
        const name = document.getElementById('22').value
        await axios.put(`http://158.160.147.53:6868/rooms/renameRoom?roomId=${roomId}`, {name: name}, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
            }
        })
            .then(() => {
                setRoom({...room, name: name})
                socket.emit("send-room-name", name)
            })
    }

    const addUser = async () => {
        const email = document.getElementById('123456789').value
        await axios.post(`http://158.160.147.53:6868/rooms/addUser?roomId=${roomId}`, {email: email}, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
            }
        })
            .then(() => {
                setUpdateUsers(prev => !prev)
                socket.emit("send-users")
            })
    }

    const deleteUser = async () => {
        const id = document.getElementById('987654321').value
        await axios.delete(`http://158.160.147.53:6868/rooms/deleteUserRoom?roomId=${roomId}&user_id=${id}`, {
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("x-auth-token")
            }
        })
            .then(() => {
                setUpdateUsers(prev => !prev)
                socket.emit("send-users")
            })
    }

    useEffect(() => {
        if (socket == null || table == null) return

        const handler = () => {
            setUpdateUsers(prev => !prev)
        }
        socket.on("receive-users", handler)

        return () => {
            socket.off("receive-users", handler)
        }
    }, [socket, table])

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


    const toBase64 = file => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
    });

    const base64encode = async () => {
        const fileInput = document.getElementById('88888888')

        const file = fileInput.files[0]
        const text = await toBase64(file)
        const result = text.split(",")[1]
        console.log(result)
        const filename = "example.msbp";
        const newfile = base64ToFile(result, filename);

        console.log(newfile); // Вывод объекта File
        downloadFile(newfile);
    }

    function downloadFile(file) {
        // Создание URL для объекта File
        const url = URL.createObjectURL(file);

        // Создание временного элемента <a>
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name; // Установка имени файла для загрузки
        document.body.appendChild(a);
        a.click(); // Инициирование загрузки
        document.body.removeChild(a); // Удаление элемента после загрузки
        URL.revokeObjectURL(url); // Освобождение памяти
    }

    function base64ToFile(base64String, filename) {
        // Удаление префикса, если он есть (например, data:image/png;base64,)
        const base64WithoutPrefix = base64String;

        // Преобразование строки Base64 в бинарные данные
        const binaryString = atob(base64WithoutPrefix);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Создание Blob из бинарных данных
        const blob = new Blob([bytes], { type: 'application/octet-stream' });

        // Создание объекта File из Blob (опционально)
        const file = new File([blob], filename, { type: blob.type });

        return file;
    }



    return (
        <>
            <h1>Room name: {room == null ? "" : room.name}</h1>
            <h3>Table name: {tableName}</h3>
            <button onClick={deleteRoom}>Delete Room</button>
            <br/>
            <div className="container" ref={wrapperRef}/>
            <button onClick={addRow}>Add Row</button>
            <button onClick={addColumn}>Add Column</button>
            <input type={'text'} id={'999999999'}/>
            <button onClick={deleteColumn}>Delete Column</button>
            <button onClick={deleteRow}>Delete Row</button>
            <br/>
            <button onClick={addTable}>Add Table</button>
            <input type={'text'} id={'333'}/>
            <button onClick={deleteTable}>Delete Table</button>
            <br/>
            <h1>Список таюлиц комнаты</h1>
            <ul>
                {allTables != null ? allTables.map((item) => (
                    <li key={item.id}><a href={item.id}>{item.name}</a></li>
                )) : ""}
            </ul>
            <br/>
            <button onClick={renameTable}>Rename Table</button>
            <input type={'text'} id={'1'}/><br/>
            <button onClick={renameRoom}>Rename Room</button>
            <input type={'text'} id={'22'}/><br/>
            <ul>
                {users != null ? users.map((item) => (
                    <li key={item._id}>{item.username}</li>
                )) : ""}
            </ul>
            <br/>
            <button onClick={addUser}>Add User</button>
            <input type={'text'} id={'123456789'}/><br/>
            <button onClick={deleteUser}>Delete User</button>
            <input type={'text'} id={'987654321'}/><br/>
            <div>Выберите язык для перевода</div>
            <select id="selectlanguage">
                <option value="en" label="Английский"></option>
                <option value="ru" label="Русский"></option>
                <option value="de" label="Немецкий"></option>
                <option value="es" label="Испанский"></option>
            </select>
            <button onClick={addColumnWithTranslate}>Добавить перевод на выбранный язык</button>
            <input type="file" id="88888888" name="file"/>
            <button onClick={base64encode}>сделать что-то страшное</button>
        </>
    )
}

export default Tables