document.getElementById("signup_form").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const userData = {
        username: formData.get("username"),
        email: formData.get("email"),
        password: formData.get("password")
    };

    try {
        const response = await fetch("http://localhost:8003/api/users/signup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(userData),
        });

        const data = await response.json();
        
        if (response.ok) {
            localStorage.setItem("token", data.token); 
            localStorage.setItem("userEmail", data.email);
            window.location.href = "dashboard.html";
        } else {
            throw new Error(data.error || "Registration failed");
        }
    } catch (err) {
        console.error("Signup Error:", err);
        alert(err.message);
    }
});