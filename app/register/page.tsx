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
          El registro en ServiceControl es solo por invitación.
          Contacta al administrador de tu hotel.
        </p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            padding: "10px 20px",
            backgroundColor: "#000",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            fontSize: "14px",
            fontWeight: "600"
          }}
        >
          Ir al login
        </a>
      </div>
    </div>
  );
}
