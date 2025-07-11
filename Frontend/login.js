document.getElementById("login_form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const rememberMe = document.querySelector("#login_form input[type='checkbox']").checked;

    try {
        const response = await fetch("http://localhost:8003/api/users/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        if (response.ok) {
            if (rememberMe) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("userEmail", data.email);
            } else {
                sessionStorage.setItem("token", data.token);
                sessionStorage.setItem("userEmail", data.email);
            }

            console.log("Token stored in browser:", localStorage.getItem("token") || sessionStorage.getItem("token"));

            window.location.href = "dashboard.html";
        } else {
            throw new Error(data.error || "Login failed");
        }
    } catch (err) {
        console.error("Login Error:", err);
        alert(err.message);
    }
});