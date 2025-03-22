// ✅ Configuración General
const API_URL = "http://localhost:3000/api"; // URL base del servidor

// ✅ Manejo Centralizado de Errores
function handleError(error) {
    console.error(error.message || error);
    Swal.fire({
        title: "Error",
        text: error.message || "Ocurrió un problema. Intenta nuevamente.",
        icon: "error",
        confirmButtonText: "Aceptar",
    });
}

// ✅ Obtener Encabezados de Autenticación
function getAuthHeaders() {
    const token = sessionStorage.getItem("token") || localStorage.getItem("token");

    if (!token) {
        console.warn("No hay token almacenado. No se puede autenticar.");
        return {};
    }

    console.log("Token obtenido para autenticación:", token);
    return { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
    };
}

// ✅ Mostrar/Ocultar Contenedores
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

// ✅ Verificar Autenticación
async function checkAuth() {
    console.log("📌 Iniciando verificación de autenticación...");

    const token = sessionStorage.getItem("token");

    if (!token) {
        console.warn("⚠️ No hay token almacenado. El usuario no está autenticado.");
        toggleContainers(false);
        return false;
    }

    try {
        const response = await fetch(`${API_URL}/dashboard`, {
            method: "GET",
            headers: getAuthHeaders()
        });

        if (response.status === 401) { 
            console.log("❌ Token inválido o expirado, eliminándolo...");
            sessionStorage.removeItem("token");
            toggleContainers(false);
            return false;
        }

        if (!response.ok) {
            throw new Error(`Error en la solicitud. Código: ${response.status}`);
        }

        console.log("✅ Token válido. Usuario autenticado.");
        toggleContainers(true);
        loadDashboard();
        return true;
    } catch (error) {
        console.error("🚨 Error en checkAuth:", error);
        sessionStorage.removeItem("token");
        toggleContainers(false);
        return false;
    }
}

// ✅ Manejo del Login
document.addEventListener("DOMContentLoaded", async () => {
    console.log("📌 DOM completamente cargado. Ejecutando checkAuth...");

    const isAuthenticated = await checkAuth();
    if (isAuthenticated) {
        console.log("📌 Usuario autenticado, cargando dashboard y pagos...");
        loadDashboard();
        loadPayments(); 
    } else {
        console.warn("⚠️ Usuario no autenticado, no se cargarán pagos.");
    }
});

// ✅ Validación del formulario de login
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
            if (!data.token) {
                throw new Error("No se recibió un token válido.");
            }

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
}

// ✅ Manejo del formulario de pagos
const paymentForm = document.getElementById("paymentForm");

if (paymentForm) {
    paymentForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const fullName = document.getElementById("fullName")?.value.trim();
        const subscriptionType = document.getElementById("subscriptionType")?.value.trim();
        const paymentDate = document.getElementById("paymentDate")?.value.trim();
        const amount = parseFloat(document.getElementById("amount")?.value.trim());

        if (!fullName || !subscriptionType || !paymentDate || isNaN(amount) || amount <= 0) {
            Swal.fire("Error", "Todos los campos son obligatorios y el monto debe ser numérico.", "warning");
            return;
        }

        console.log("📤 Enviando datos del formulario:", { fullName, subscriptionType, paymentDate, amount });

        try {
            const response = await fetch(`${API_URL}/payments`, {
                method: "POST",
                headers: getAuthHeaders(),
                body: JSON.stringify({ fullName, subscriptionType, paymentDate, amount })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Error al guardar el pago.");
            }

            Swal.fire("Éxito", "Pago guardado correctamente.", "success").then(() => {
                loadPayments();
            });

        } catch (error) {
            console.error("🚨 Error al guardar pago:", error);
            Swal.fire("Error", error.message, "error");
        }
    });
}

function updateAmount() {
    const subscriptionType = document.getElementById("subscriptionType").value;
    document.getElementById("amount").value = subscriptionType; // 🔹 Actualiza el monto automáticamente
    console.log("💰 Monto actualizado:", subscriptionType);
}



// ✅ Guardar Pago (corregido y validado)
// ✅ Guardar Pago (corregido y validado)
async function savePayment() {
    const fullName = document.getElementById("fullName")?.value.trim();
    const subscriptionType = document.getElementById("subscriptionType")?.value.trim();
    const paymentDate = document.getElementById("paymentDate")?.value.trim();
    
    // 🛠️ Capturar el campo de monto correctamente
    const amountInput = document.getElementById("amount");

    if (!amountInput || amountInput.value.trim() === "") {
        console.error("❌ Error: No se encontró el campo 'amount' en el formulario o está vacío.");
        Swal.fire("Error", "Debes ingresar un monto válido.", "warning");
        return;
    }

    const amount = parseFloat(amountInput.value.trim());

    // ✅ Validaciones antes de enviar
    if (!fullName || fullName.length < 3) {
        Swal.fire("Error", "El nombre debe tener al menos 3 caracteres.", "warning");
        return;
    }
    if (!subscriptionType || isNaN(subscriptionType)) {
        Swal.fire("Error", "El tipo de suscripción debe ser válido.", "warning");
        return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
        Swal.fire("Error", "La fecha debe estar en formato YYYY-MM-DD.", "warning");
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        Swal.fire("Error", "El monto debe ser un número positivo.", "warning");
        return;
    }

    console.log("📤 Enviando datos del pago:", { fullName, subscriptionType, paymentDate, amount });

    try {
        const response = await fetch(`${API_URL}/payments`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders()
            },
            body: JSON.stringify({ fullName, subscriptionType, paymentDate, amount })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || "Error al guardar el pago.");
        }

        console.log("✅ Pago guardado correctamente.");
        Swal.fire("Éxito", "Pago guardado correctamente.", "success").then(() => {
            loadPayments(); // 🔄 Recargar la lista de pagos después de guardar
        });

    } catch (error) {
        console.error("🚨 Error al guardar pago:", error);
        Swal.fire("Error", error.message, "error");
    }
}


// ✅ Cargar Pagos (mejorado)
let totalIncome = 0; // Definimos la variable global

async function loadPayments() {
    console.log("📊 Cargando pagos desde el backend...");

    const token = sessionStorage.getItem("token");

    if (!token) {
        console.warn("🚨 No hay token disponible. No se puede obtener pagos.");
        return; // ❌ Evita hacer la solicitud si no hay token
    }

    try {
        const response = await fetch(`${API_URL}/payments`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            console.warn("🔴 No autorizado. El usuario debe iniciar sesión.");
            return;
        }

        if (!response.ok) {
            throw new Error(`Error al obtener pagos. Código: ${response.status}`);
        }

        // ✅ Extraer correctamente los valores del backend
        const { totalIncome, overduePayments, upcomingPayments } = await response.json();
       

        console.log("✅ Datos obtenidos del backend:", { totalIncome, overduePayments, upcomingPayments });

        // ✅ Buscar el elemento correcto para totalIncome
        const totalIncomeElement = document.getElementById("totalIncomeAmount");

        if (!totalIncomeElement) {
            console.error("⚠️ No se encontró el elemento donde actualizar totalIncome.");
            return;
        }

        // ✅ Validar que totalIncome sea un número antes de actualizarlo
        if (typeof totalIncome !== "number" || isNaN(totalIncome)) {
            console.error("🚨 Error: totalIncome no es un número válido:", totalIncome);
            return;
        }

        // ✅ Actualizar el total de ingresos en el Dashboard
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

        if (!response.ok) {
            throw new Error(`Error en la búsqueda. Código: ${response.status}`);
        }

        const payments = await response.json();
        console.log("✅ Pagos encontrados:", payments);

        const tableBody = document.getElementById("clientPaymentsTableBody");
        tableBody.innerHTML = payments.length 
            ? payments.map(payment => `
                <tr>
                    <td>${payment.id || 'N/A'}</td>
                    <td>${payment.fullName || 'Desconocido'}</td>
                    <td>${payment.paymentDate || 'Sin fecha'}</td>
                    <td>$${payment.amount ? Number(payment.amount).toLocaleString("es-AR") : 'N/A'}</td>
                </tr>`).join('') 
            : '<tr><td colspan="4">No se encontraron pagos.</td></tr>';

    } catch (error) {
        console.error("🚨 Error al buscar pagos:", error);
        Swal.fire({ title: "Error", text: error.message, icon: "error", confirmButtonText: "Aceptar" });
    }
});


// ✅ Ejecutar `loadPayments()` automáticamente cuando se cargue la página
document.addEventListener("DOMContentLoaded", () => {
    const paymentForm = document.getElementById("paymentForm");

    if (paymentForm) {
        paymentForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const fullName = document.getElementById("fullName")?.value.trim();
            const subscriptionType = document.getElementById("subscriptionType")?.value.trim();
            const paymentDate = document.getElementById("paymentDate")?.value.trim();
            const amount = parseFloat(subscriptionType); // 🔹 Capturar el monto desde el select

            console.log("🔎 Valores capturados del formulario:", { fullName, subscriptionType, paymentDate, amount });

            if (!fullName || !subscriptionType || !paymentDate || isNaN(amount) || amount <= 0) {
                console.warn("❌ Falta información en la solicitud.");
                Swal.fire("Error", "Todos los campos son obligatorios.", "warning");
                return;
            }

            console.log("📤 Enviando datos del formulario:", { fullName, subscriptionType, paymentDate, amount });
            await savePayment(fullName, subscriptionType, paymentDate, amount);
        });

        console.log("✅ Formulario de pagos vinculado correctamente.");
    } else {
        console.warn("⚠️ No se encontró el formulario de pagos.");
    }
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

// ✅ Función para actualizar el Dashboard en la interfaz
function updateDashboard(data) {
    console.log("✅ Datos obtenidos del backend:", data);

    // 🔍 Capturar los elementos del DOM
    const totalIncomeElement = document.getElementById("totalIncomeAmount");
    const overduePaymentsElement = document.getElementById("overduePaymentsCount");
    const upcomingPaymentsElement = document.getElementById("upcomingPaymentsCount");
    const overduePaymentsList = document.getElementById("overduePaymentsList");
    const upcomingPaymentsList = document.getElementById("upcomingPaymentsList");

    // 🔹 Verificar si los elementos existen antes de actualizarlos
    if (!totalIncomeElement || !overduePaymentsElement || !upcomingPaymentsElement || !overduePaymentsList || !upcomingPaymentsList) {
        console.warn("⚠️ Uno o más elementos del Dashboard no se encontraron en el DOM.");
        return;
    }

    // 🔹 Actualizar total de ingresos
    totalIncomeElement.textContent = data.totalIncome.toLocaleString("es-AR", { style: "currency", currency: "ARS" });

    // 🔹 Actualizar número de pagos vencidos
    overduePaymentsElement.textContent = data.overduePayments.length;
    
    // 🔹 Actualizar número de pagos próximos a vencer
    upcomingPaymentsElement.textContent = data.upcomingPayments.length;

    // ✅ Mostrar lista de clientes con pagos vencidos
    overduePaymentsList.innerHTML = ""; // 🔹 Limpiar lista antes de agregar datos
    if (data.overduePayments.length > 0) {
        data.overduePayments.forEach(client => {
            const li = document.createElement("li");
            li.textContent = client;
            overduePaymentsList.appendChild(li);
        });
    } else {
        overduePaymentsList.innerHTML = "<li>No hay pagos vencidos</li>";
    }

    // ✅ Mostrar lista de clientes con pagos próximos a vencer
    upcomingPaymentsList.innerHTML = ""; // 🔹 Limpiar lista antes de agregar datos
    if (data.upcomingPayments.length > 0) {
        data.upcomingPayments.forEach(client => {
            const li = document.createElement("li");
            li.textContent = client;
            upcomingPaymentsList.appendChild(li);
        });
    } else {
        upcomingPaymentsList.innerHTML = "<li>No hay pagos próximos a vencer</li>";
    }

    console.log("📌 Contenido final de overduePaymentsList:", overduePaymentsList.innerHTML);
    console.log("📌 Contenido final de upcomingPaymentsList:", upcomingPaymentsList.innerHTML);

    console.log("✅ Dashboard actualizado correctamente.");
}




// ✅ Cargar Dashboard (versión corregida)

async function loadDashboard() {
    console.log("📊 Cargando información del Dashboard...");
    try {
        const response = await fetch(`${API_URL}/dashboard`, { method: "GET", headers: getAuthHeaders() });

        if (!response.ok) throw new Error("Error al obtener datos del Dashboard");

        const data = await response.json();
        console.log("✅ Datos obtenidos del backend:", data);

        // 🔹 Verificar si `paymentsPerMonth` existe antes de usarlo
        if (!data.paymentsPerMonth || data.paymentsPerMonth.length === 0) {
            console.warn("⚠️ No hay datos de ingresos mensuales.");
        } else {
            console.table(data.paymentsPerMonth);

            // ✅ Capturar elemento del DOM para ingresos mensuales
            const monthlyIncomeTableBody = document.getElementById("monthlyIncomeTableBody");
if (monthlyIncomeTableBody) {
    monthlyIncomeTableBody.innerHTML = "";
    let pastMonthsTotal = 0;
}

    const today = new Date(); // 🟩 Agregado
    const currentMonth = today.toISOString().slice(0, 7); // 🟩 Agregado

    data.paymentsPerMonth.forEach(entry => {
        console.log(`📅 Mes: ${entry.month}, Ingreso: ${entry.totalIncome}`);
        const row = document.createElement("tr");
        row.innerHTML = `
            <td><strong>${entry.month}</strong></td>
            <td class="fw-bold text-success">$${entry.totalIncome.toLocaleString("es-AR")}</td>
        `;
        monthlyIncomeTableBody.appendChild(row);

        if (entry.month !== currentMonth) {
            pastMonthsTotal += entry.totalIncome;
        }
    });

    const pastTotalElement = document.getElementById("pastMonthsTotal");
    if (pastTotalElement) {
        pastTotalElement.textContent = pastMonthsTotal.toLocaleString("es-AR", {
            style: "currency",
            currency: "ARS"
        });
    }
}


        // ✅ Capturar y actualizar la lista de pagos vencidos
        const overduePaymentsList = document.getElementById("overduePaymentsList");
        const overduePaymentsCount = document.getElementById("overduePaymentsCount");

        if (!overduePaymentsList || !overduePaymentsCount) {
            console.error("🚨 Error: No se encontraron los elementos para mostrar pagos vencidos.");
        } else {
            overduePaymentsList.innerHTML = "";
            
            if (!data.overduePayments || data.overduePayments.length === 0) {
                console.warn("⚠️ No hay pagos vencidos en la API.");
                overduePaymentsList.innerHTML = "<li>No hay pagos vencidos</li>";
            } else {
                overduePaymentsCount.textContent = data.overduePayments.length;

                data.overduePayments.forEach(client => {
                    console.log(`🔴 Pago vencido: ${client}`);

                    const li = document.createElement("li");
                    li.textContent = client;
                    li.style.backgroundColor = "#ffcccc"; // Fondo rojo claro
                    li.style.padding = "5px";
                    li.style.margin = "5px 0";
                    li.style.borderRadius = "5px";
                    li.style.fontWeight = "bold";

                    overduePaymentsList.appendChild(li);
                });
            }
        }

        console.log("✅ Dashboard actualizado correctamente.");
    } catch (error) {
        console.error("🚨 Error en loadDashboard:", error);
        handleError(error);
    }
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

        const data = await response.json(); // ✅ Línea corregida
        console.log("✅ Pago guardado correctamente:", data);

        Swal.fire("Éxito", "Pago guardado correctamente.", "success").then(() => { // ✅ Línea corregida
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
