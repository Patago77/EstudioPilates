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
  const token = sessionStorage.getItem("token");
  if (!token) {
    console.warn("Token no encontrado en sessionStorage.");
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ✅ Mostrar/Ocultar Contenedores
function toggleContainers(showApp) {
  const loginContainer = document.getElementById("loginContainer");
  const appContainer = document.getElementById("appContainer");

  if (loginContainer && appContainer) {
    loginContainer.style.display = showApp ? "none" : "block";
    appContainer.style.display = showApp ? "block" : "none";
  }
}

// ✅ Verificar Autenticación
async function checkAuth() {
  console.log("Iniciando verificación de autenticación...");
  const token = sessionStorage.getItem("token");

  if (!token) {
    console.warn("No se encontró un token. Mostrando el formulario de inicio de sesión.");
    toggleContainers(false);
    return false;
  }

  const headers = getAuthHeaders();
  console.log("Encabezados de autorización:", headers);

  try {
    const response = await fetch(`${API_URL}/verify-token`, {
      method: "GET",
      headers,
    });

    if (!response.ok) {
      throw new Error("Error verificando el token.");
    }

    const data = await response.json();
    if (data.valid) {
      console.log(`Usuario autenticado: ${data.user.username}`);
      toggleContainers(true);
      loadDashboard();
    } else {
      throw new Error("Token inválido.");
    }
  } catch (error) {
    console.error("Error en la autenticación:", error);
    handleError(error);
    toggleContainers(false);
  }
}

// ✅ Inicio de Sesión
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Error al iniciar sesión.");
      }

      const data = await response.json();
      sessionStorage.setItem("token", data.token);

      Swal.fire({
        title: "¡Sesión iniciada!",
        icon: "success",
        confirmButtonText: "Aceptar",
      }).then(() => location.reload());
    } catch (error) {
      handleError(error);
    }
  });
}

// ✅ Buscar Pagos por Cliente
async function searchPaymentsByClient(searchQuery) {
  try {
    if (!searchQuery || typeof searchQuery !== "string") {
      throw new Error("Consulta de búsqueda inválida.");
    }

    console.log(`Fetching: ${API_URL}/payments/client/${encodeURIComponent(searchQuery)}`);

    const response = await fetch(`${API_URL}/payments/client/${encodeURIComponent(searchQuery)}`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || "Error al buscar pagos.");
    }

    return await response.json();
  } catch (error) {
    handleError(error);
    return [];
  }
}

const clientSearchForm = document.getElementById("clientSearchForm");
if (clientSearchForm) {
  clientSearchForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const clientSearchInput = document.getElementById("clientSearchInput");
    if (!clientSearchInput) return;

    const searchQuery = clientSearchInput.value.trim();

    if (!searchQuery) {
      Swal.fire({
        title: "Error",
        text: "Por favor, ingresa un nombre de cliente para buscar.",
        icon: "warning",
        confirmButtonText: "Aceptar",
      });
      return;
    }

    const payments = await searchPaymentsByClient(searchQuery);
    const tableBody = document.getElementById("clientPaymentsTableBody");
    if (tableBody) {
      tableBody.innerHTML = "";

      if (payments.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4">No se encontraron pagos.</td></tr>';
        return;
      }

      payments.forEach((payment) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${payment.id}</td>
          <td>${payment.fullName}</td>
          <td>${payment.paymentDate}</td>
          <td>$${Number(payment.subscriptionType || 0).toLocaleString("es-AR")}</td>
        `;
        tableBody.appendChild(row);
      });
    }
  });
}

// ✅ Manejar el cierre de sesión
const logoutButton = document.getElementById("logoutButton");
if (logoutButton) {
  logoutButton.addEventListener("click", () => {
    Swal.fire({
      title: "¿Estás seguro?",
      text: "Se cerrará tu sesión actual.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Cerrar Sesión",
      cancelButtonText: "Cancelar",
    }).then((result) => {
      if (result.isConfirmed) {
        sessionStorage.removeItem("token");
        Swal.fire({
          title: "Sesión cerrada",
          text: "Tu sesión se ha cerrado correctamente.",
          icon: "success",
          confirmButtonText: "Aceptar",
        }).then(() => {
          location.reload();
        });
      }
    });
  });
}

// ✅ Cargar el Dashboard
async function loadDashboard() {
  try {
    const response = await fetch(`${API_URL}/dashboard`, {
      method: "GET",
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error("Error al cargar el dashboard.");

    const data = await response.json();
    const overdueList = JSON.parse(data.overdueList || "[]");
    const upcomingList = JSON.parse(data.upcomingList || "[]");

    const overduePaymentsCount = document.getElementById("overduePaymentsCount");
    const upcomingPaymentsCount = document.getElementById("upcomingPaymentsCount");

    if (overduePaymentsCount) overduePaymentsCount.textContent = overdueList.length;
    if (upcomingPaymentsCount) upcomingPaymentsCount.textContent = upcomingList.length;
  } catch (error) {
    handleError(error);
  }
}

["overduePayments", "upcomingPayments"].forEach((id) => {
  const button = document.getElementById(id);
  if (button) {
    button.addEventListener("click", async () => {
      try {
        const response = await fetch(`${API_URL}/dashboard`, {
          method: "GET",
          headers: getAuthHeaders(),
        });

        if (!response.ok) throw new Error("Error al obtener datos del dashboard.");

        const data = await response.json();
        const list =
          id === "overduePayments"
            ? JSON.parse(data.overdueList || "[]")
            : JSON.parse(data.upcomingList || "[]");

        if (list.length === 0) {
          Swal.fire({
            title:
              id === "overduePayments"
                ? "Sin pagos vencidos"
                : "Sin pagos próximos a vencer",
            text: "No hay registros disponibles.",
            icon: "info",
            confirmButtonText: "Aceptar",
          });
          return;
        }

        let message = "<ul>";
        list.forEach((payment) => {
          message += `<li>${payment.fullName} - Fecha: ${payment.paymentDate}</li>`;
        });
        message += "</ul>";

        Swal.fire({
          title:
            id === "overduePayments"
              ? "Pagos Vencidos"
              : "Pagos Próximos a Vencer",
          html: message,
          icon: "info",
          confirmButtonText: "Aceptar",
        });
      } catch (error) {
        handleError(error);
      }
    });
  }
});

document.addEventListener("DOMContentLoaded", checkAuth);
