export default function RegisterPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#f5f5f5"
    }}>
      <div style={{
        backgroundColor: "white",
        padding: "32px",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        width: "100%",
        maxWidth: "400px",
        textAlign: "center"
      }}>
        <h1 style={{ fontSize: "24px", fontWeight: "700", marginBottom: "8px" }}>
          ServiceControl
        </h1>
        <p style={{ opacity: 0.7, marginBottom: "24px", fontSize: "15px" }}>
          El registro en ServiceControl es por invitación del administrador de tu hotel.
          ¿Aún no tenéis cuenta? Prueba la plataforma gratis 14 días.
        </p>
        <a
          href="/trial"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            backgroundColor: "#185FA5",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "600",
            marginBottom: "12px"
          }}
        >
          Probar gratis 14 días
        </a>
        <div>
          <a
            href="/login"
            style={{
              display: "inline-block",
              padding: "10px 20px",
              color: "#333",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "600"
            }}
          >
            Ir al login
          </a>
        </div>
      </div>
    </div>
  );
}
