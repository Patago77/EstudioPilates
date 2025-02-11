// Configuracion General
const API_URL = "http://localhost:3000/api"; // URL base del servidor

// Manejo Centralizado de Errores
function handleError(error) {
    console.error(error.message || error);
    Swal.fire({
        title: "Error",
        text: error.message || "Ocurrió un problema. Intenta nuevamente.",
        icon: "error",
        confirmButtonText: "Aceptar",
    });
}

// Obtener Encabezados de Autenticacion
function getAuthHeaders() {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");

    if (!token) {
        console.warn("No hay token almacenado. No se puede autenticar.");
        return {};
    }

    console.log("Token obtenido para autenticacion:", token);
    return { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// Mostrar/Ocultar Contenedores
function toggleContainers(showApp) {
    const loginContainer = document.getElementById("loginContainer");
    const appContainer = document.getElementById("appContainer");
    
    if (loginContainer) {
        loginContainer.style.display = showApp ? "none" : "block";
    }
    if (appContainer) {
        appContainer.style.display = showApp ? "block" : "none";
    }
}

// Verificar Autenticacion
async function checkAuth() {
    console.log("Iniciando verificación de autenticacion...");

    // Obtener el token almacenado
    const token = sessionStorage.getItem("token");

    if (!token) {
        console.log("No hay token almacenado, cerrando sesión.");
        toggleContainers(false);
        return false;
    }

    try {
        // Verificamos los headers antes de la petición
        const headers = {
            "Content-Type": "application/json",
            ...getAuthHeaders()
        };
        console.log("Headers enviados en la peticion:", headers);

        // Petición al backend
        const response = await fetch(`${API_URL}/dashboard`, {
            method: "GET",
            headers: headers
        });

        console.log("Respuesta recibida:", response.status, response.statusText);

        if (response.status === 401) {
            console.log("Token invalido, cerrando sesión.");
            sessionStorage.removeItem("token");
            toggleContainers(false);
            return false;
        }

        if (!response.ok) {
            throw new Error(`Error en la solicitud. Codigo: ${response.status}`);
        }

        console.log("Token valido. Usuario autenticado.");
        toggleContainers(true);
        loadDashboard();
        return true;
    } catch (error) {
        console.error("Error en checkAuth:", error);
        sessionStorage.removeItem("token");
        toggleContainers(false);
        return false;
    }
}
// Manejo del Login
const loginForm = document.getElementById("loginForm");

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const username = document.getElementById("username")?.value.trim();
        const password = document.getElementById("password")?.value.trim();

        if (!username || !password) {
            Swal.fire({
                title: "Error",
                text: "Usuario y contraseña requeridos.",
                icon: "warning",
                confirmButtonText: "Aceptar"
            });
            return;
        }

        console.log("📤 Enviando login con:", { username });

        try {
            const response = await fetch(`${API_URL}/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password }),
            });

            console.log("📡 Respuesta del servidor:", response.status, response.statusText);

            // Verificar si la respuesta es válida antes de intentar convertirla a JSON
            if (!response.ok) {
                let errorText = "Error desconocido";
                try {
                    const errorData = await response.json();
                    errorText = errorData.error || "Error en el inicio de sesión";
                } catch (jsonError) {
                    console.error("⚠️ No se pudo leer la respuesta JSON:", jsonError);
                }

                throw new Error(errorText);
            }

            const data = await response.json();
            console.log("🔑 Token recibido en login:", data.token);

            if (!data.token) {
                throw new Error("No se recibió un token válido.");
            }

            // Almacenar token en sesión
            sessionStorage.setItem("token", data.token);
            console.log("✅ Token almacenado correctamente.");

            Swal.fire({
                title: "Bienvenido",
                text: "Inicio de sesión exitoso.",
                icon: "success",
                confirmButtonText: "Continuar"
            }).then(() => {
                location.reload();
            });

        } catch (error) {
            console.error("🚨 Error en login:", error.message);
            Swal.fire({
                title: "Error",
                text: error.message,
                icon: "error",
                confirmButtonText: "Aceptar"
            });
        }
    });
} else {
    console.warn("⚠️ No se encontró el formulario de login.");
}

document.addEventListener("DOMContentLoaded", () => {
    const paymentForm = document.getElementById("paymentForm");

    if (paymentForm) {
        paymentForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const fullName = document.getElementById("fullName")?.value.trim();
            const subscriptionType = document.getElementById("subscriptionType")?.value.trim();
            const paymentDate = document.getElementById("paymentDate")?.value.trim(); // Capturar fecha de pago

            console.log("🔎 Valores capturados del formulario:", { fullName, subscriptionType, paymentDate });

            if (!fullName || !subscriptionType || !paymentDate) {
                console.warn("❌ Falta información en la solicitud.");
                Swal.fire("Error", "Todos los campos son obligatorios.", "warning");
                return;
            }

            console.log("📤 Enviando datos del formulario:", { fullName, subscriptionType, paymentDate });
            await savePayment(fullName, subscriptionType, paymentDate);
        });

        console.log("✅ Formulario de pagos vinculado correctamente.");
    } else {
        console.warn("⚠️ No se encontró el formulario de pagos.");
    }
});



async function savePayment(fullName, subscriptionType, amount) {
    amount = parseFloat(amount); // Asegurar que amount sea un número

    console.log("🔎 Valores antes de enviar:", { fullName, subscriptionType, amount });

    if (!fullName || !subscriptionType || isNaN(amount) || amount <= 0) {
        console.warn("❌ Falta información en la solicitud.");
        Swal.fire("Error", "Todos los campos son obligatorios y el monto debe ser mayor a 0.", "warning");
        return;
    }

    try {
        const response = await fetch(`${API_URL}/payments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({ fullName, subscriptionType, amount }) // Enviando correctamente amount
        });

        console.log("📡 Respuesta del servidor:", response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Error al guardar el pago.");
        }

        console.log("✅ Pago guardado correctamente.");
        Swal.fire("Éxito", "Pago guardado correctamente.", "success").then(() => {
            loadPayments();
        });

    } catch (error) {
        console.error("🚨 Error al guardar pago:", error);
        Swal.fire("Error", error.message, "error");
    }
}


let totalIncome = 0; // Definimos la variable global
async function loadPayments() {
    console.log("📊 Cargando pagos desde el backend...");
    
    try {
        const response = await fetch(`${API_URL}/payments`, {
            method: "GET",
            headers: { ...getAuthHeaders() }
        });

        if (!response.ok) {
            throw new Error("Error al obtener pagos");
        }

        // ✅ Extraer correctamente los valores del backend
        const { totalIncome, overduePayments, upcomingPayments } = await response.json();
        console.log("✅ Datos obtenidos del backend:", { totalIncome, overduePayments, upcomingPayments });

        // ✅ Buscar el elemento correcto para totalIncome
        const totalIncomeElement = document.getElementById("totalIncome") || document.getElementById("totalIncomeAmount");

        if (!totalIncomeElement) {
            console.error("⚠️ No se encontró el elemento donde actualizar totalIncome.");
            return;
        }

        // ✅ Actualizar el total de ingresos
        totalIncomeElement.textContent = totalIncome.toLocaleString("es-AR", { style: "currency", currency: "ARS" });

        console.log("✅ totalIncome actualizado correctamente:", totalIncomeElement.textContent);

    } catch (error) {
        console.error("🚨 Error al cargar pagos:", error.message);
    }
}


// ✅ Evento en el formulario de búsqueda de pagos
document.getElementById("clientSearchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const searchQuery = document.getElementById("clientSearchInput")?.value.trim();
    if (!searchQuery) {
        Swal.fire({ title: "Error", text: "Por favor, ingresa un nombre de cliente para buscar.", icon: "warning", confirmButtonText: "Aceptar" });
        return;
    }
    try {
        console.log("🔍 Buscando pagos para:", searchQuery);
        const response = await fetch(`${API_URL}/payments/client/${encodeURIComponent(searchQuery)}`, { method: "GET", headers: getAuthHeaders() });
        
        if (response.status === 404) {
            Swal.fire({ title: "No encontrado", text: "No hay pagos registrados para este cliente.", icon: "info", confirmButtonText: "Aceptar" });
            return;
        }
        if (!response.ok) throw new Error("Error al buscar pagos.");
        
        const payments = await response.json();
        const tableBody = document.getElementById("clientPaymentsTableBody");
        tableBody.innerHTML = payments.length 
            ? payments.map(payment => `
                <tr>
                    <td>${payment.id || 'N/A'}</td>
                    <td>${payment.fullName || 'Desconocido'}</td>
                    <td>${payment.paymentDate || 'Sin fecha'}</td>
                    <td>$${payment.subscriptionType ? Number(payment.subscriptionType).toLocaleString("es-AR") : 'N/A'}</td>
                </tr>`).join('') 
            : '<tr><td colspan="4">No se encontraron pagos.</td></tr>';
    } catch (error) {
        handleError(error);
    }
});
async function loadPayments() {
    console.log("📊 Cargando pagos desde el backend...");
    
    try {
        const response = await fetch(`${API_URL}/payments`, {
            method: "GET",
            headers: { ...getAuthHeaders() }
        });

        if (!response.ok) {
            throw new Error(`Error al obtener pagos. Código: ${response.status}`);
        }

        const data = await response.json();
        console.log("🔍 Datos recibidos del backend:", data);

        // Verifica que totalIncome existe antes de usarlo
        if (!("totalIncome" in data)) {
            throw new Error("totalIncome no está presente en la respuesta del servidor");
        }

        // ✅ Actualizar la UI con los datos obtenidos
        const totalIncomeElement = document.getElementById("totalIncomeAmount");

        if (totalIncomeElement) {
            totalIncomeElement.textContent = data.totalIncome.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
            console.log("✅ totalIncome actualizado:", totalIncomeElement.textContent);
        } else {
            console.error("⚠️ No se encontró el elemento donde actualizar totalIncome.");
        }
    } catch (error) {
        console.error("🚨 Error al cargar pagos:", error.message);
    }
}
// ✅ Ejecutar `loadPayments()` automáticamente cuando se cargue la página
document.addEventListener("DOMContentLoaded", () => {
    loadPayments();
});





function updatePaymentsTable(payments) {
    try {
        const oldTableBody = document.getElementById("clientPaymentsTableBody");

        if (!oldTableBody) {
            console.error("❌ No se encontró la tabla en el DOM.");
            return;
        }

        console.log("📄 Antes de actualizar tabla:", oldTableBody.innerHTML);

        // Crear un nuevo tbody para reemplazar el actual
        const newTableBody = document.createElement("tbody");
        newTableBody.id = "clientPaymentsTableBody";

        // 🔍 Verificar si hay caracteres inesperados en los datos antes de insertarlos
        payments.forEach((payment, index) => {
            console.log(`📌 Registro ${index + 1}:`, payment);
            if (/[^\x20-\x7E]/.test(payment.fullName)) {
                console.warn(`⚠️ Caracteres extraños detectados en fullName: ${payment.fullName}`);
            }
            if (/[^\x20-\x7E]/.test(payment.subscriptionType)) {
                console.warn(`⚠️ Caracteres extraños detectados en subscriptionType: ${payment.subscriptionType}`);
            }
            if (/[^\x20-\x7E]/.test(payment.paymentDate)) {
                console.warn(`⚠️ Caracteres extraños detectados en paymentDate: ${payment.paymentDate}`);
            }
        });

        // Ordenar los pagos por fecha de forma descendente
        payments.sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));

        // Generar filas
        const rowsHTML = payments.map(payment => `
            <tr>
                <td>${payment.id}</td>
                <td>${payment.fullName}</td>
                <td>${payment.paymentDate}</td>
                <td>$${Number(payment.subscriptionType).toLocaleString("es-AR")}</td>
            </tr>
        `).join('');

        console.log("HTML generado:", rowsHTML);

        newTableBody.innerHTML = rowsHTML;

        console.log("Después de actualizar tabla:", newTableBody.innerHTML);

        // Reemplazar el tbody viejo con el nuevo, solo si existe
        if (oldTableBody.parentNode) {
            oldTableBody.parentNode.replaceChild(newTableBody, oldTableBody);
            console.log("✅ Tabla de pagos actualizada.");
        } else {
            console.error("❌ No se pudo reemplazar el tbody, el padre no existe.");
        }
    } catch (error) {
        console.error("🚨 Error al cargar pagos:", error);
    }
}



// ✅ Cargar Dashboard
async function loadDashboard() {
    try {
        console.log("📊 Cargando dashboard...");

        const totalIncomeElement = document.getElementById("totalIncomeAmount");

        if (!totalIncomeElement) {
            console.warn("⚠️ Elemento 'totalIncomeAmount' no encontrado en el DOM.");
        } else {
            totalIncomeElement.textContent = totalIncome.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
            console.log("✅ totalIncomeAmount actualizado correctamente.");
        }

    } catch (error) {
        console.error("🚨 Error en loadDashboard:", error);
        handleError(error);
    }
}


const totalIncomeElement = document.getElementById("totalIncome") || document.getElementById("totalIncomeAmount");
if (totalIncomeElement) {
    totalIncomeElement.textContent = totalIncome.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
    console.log("✅ totalIncome actualizado en:", totalIncomeElement);
} else {
    console.error("⚠️ No se encontró el elemento para mostrar totalIncome.");
}



       

async function addPayment() {
    const fullName = document.getElementById("fullName").value.trim();
    const subscriptionType = document.getElementById("subscriptionType").value.trim();
    const paymentDate = document.getElementById("paymentDate").value.trim();

    if (!fullName || !subscriptionType || !paymentDate) {
        console.warn("⚠️ Faltan datos en el formulario.");
        Swal.fire("Error", "Todos los campos son obligatorios.", "warning");
        return;
    }

    const paymentData = { fullName, subscriptionType, paymentDate };
    console.log("📤 Enviando pago al backend:", paymentData);

    try {
        const response = await fetch(`${API_URL}/payments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify(paymentData)
        });

        console.log("📡 Respuesta del servidor:", response);

        if (!response.ok) {
            const errorData = await response.json();
            console.error(`❌ Error al guardar pago: ${response.status} - ${errorData.error}`);
            throw new Error(errorData.error || "Error al guardar el pago.");
        }

        const data = await response.json();
        console.log("✅ Pago guardado correctamente:", data);

        Swal.fire("Éxito", "Pago guardado correctamente.", "success").then(() => {
            console.log("🔄 Ejecutando loadPayments() después de guardar...");
            loadPayments(); // 🔄 Recargar pagos después de guardar
        });

    } catch (error) {
        console.error("🚨 Error al guardar pago:", error);
        Swal.fire("Error", error.message, "error");
    }
}





// Ejecutar al cargar la página
document.addEventListener("DOMContentLoaded", () => {
    loadPayments();
});


// ✅ Evento en el formulario de búsqueda de pagos
document.getElementById("clientSearchForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const searchQuery = document.getElementById("clientSearchInput")?.value.trim();
    if (!searchQuery) {
        Swal.fire({ title: "Error", text: "Por favor, ingresa un nombre de cliente para buscar.", icon: "warning", confirmButtonText: "Aceptar" });
        return;
    }
    try {
        const response = await fetch(`${API_URL}/payments/client/${encodeURIComponent(searchQuery)}`, { method: "GET", headers: getAuthHeaders() });
        if (!response.ok) throw new Error("Error al buscar pagos.");
        const payments = await response.json();
        const tableBody = document.getElementById("clientPaymentsTableBody");
        tableBody.innerHTML = payments.length 
            ? payments.map(payment => `
                <tr>
                    <td>${payment.id || 'N/A'}</td>
                    <td>${payment.fullName || 'Desconocido'}</td>
                    <td>${payment.paymentDate || 'Sin fecha'}</td>
                    <td>$${payment.subscriptionType ? Number(payment.subscriptionType).toLocaleString("es-AR") : 'N/A'}</td>
                </tr>`).join('') 
            : '<tr><td colspan="4">No se encontraron pagos.</td></tr>';
    } catch (error) {
        handleError(error);
    }
});

// ✅ Manejo del Cierre de Sesión
document.getElementById("logoutButton")?.addEventListener("click", () => {
    Swal.fire({ title: "¿Estás seguro?", text: "Se cerrará tu sesión actual.", icon: "warning", showCancelButton: true, confirmButtonText: "Cerrar Sesión", cancelButtonText: "Cancelar" })
    .then((result) => {
        if (result.isConfirmed) {
            sessionStorage.removeItem("token");
            Swal.fire({ title: "Sesión cerrada", text: "Tu sesión se ha cerrado correctamente.", icon: "success", confirmButtonText: "Aceptar" })
            .then(() => location.reload());
        }
    });
});

// ✅ Mostrar pagos vencidos y próximos a vencer
document.getElementById("overduePayments")?.addEventListener("click", () => showPaymentList("overdue"));
document.getElementById("upcomingPayments")?.addEventListener("click", () => showPaymentList("upcoming"));

async function showPaymentList(type) {
    try {
        const response = await fetch(`${API_URL}/dashboard`, { method: "GET", headers: getAuthHeaders() });
        if (!response.ok) throw new Error("Error al obtener datos del dashboard.");
        const data = await response.json();
        let list = Array.isArray(data[type + "List"]) ? data[type + "List"] : [];
        if (list.length === 0) {
            Swal.fire({ title: type === "overdue" ? "Sin pagos vencidos" : "Sin pagos próximos a vencer", text: "No hay registros disponibles.", icon: "info", confirmButtonText: "Aceptar" });
            return;
        }
        let message = `<ul>${list.map(payment => `<li>${payment.fullName} - Fecha: ${payment.paymentDate}</li>`).join('')}</ul>`;
        Swal.fire({ title: type === "overdue" ? "Pagos Vencidos" : "Pagos Próximos a Vencer", html: message, icon: "info", confirmButtonText: "Aceptar" });
    } catch (error) {
        handleError(error);
    }
}

// ✅ Ejecutar autenticación y cargar el Dashboard
document.addEventListener("DOMContentLoaded", () => {
    console.log("📌 DOM completamente cargado. Ejecutando checkAuth...");
    checkAuth().then(isAuthenticated => { 
        if (isAuthenticated) {
            console.log("📌 Usuario autenticado, cargando dashboard...");
            loadDashboard();
        }
    });
});
