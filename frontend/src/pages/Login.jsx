import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";


export default function Login() {

  const navigate = useNavigate();

  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);


  const handleSubmit = async (event) => {

    event.preventDefault();

    setError("");
    setLoading(true);

    try {

      await login(
        email,
        password
      );

      navigate("/dashboard");

    } catch (error) {

      setError(
        error.response?.data?.detail ||
        "Login failed"
      );

    } finally {

      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">

      <div className="w-full max-w-md">

        <div className="mb-8 text-center">

          <h1 className="text-3xl font-bold text-white">
            Smart AI Meeting Assistant
          </h1>

          <p className="mt-2 text-slate-400">
            Turn meetings into actionable insights.
          </p>

        </div>


        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-8 shadow-xl"
        >

          <h2 className="text-2xl font-semibold text-slate-900">
            Welcome back
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Sign in to your account
          </p>


          {error && (
            <div className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}


          <div className="mt-6">

            <label className="text-sm font-medium text-slate-700">
              Email
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              placeholder="you@example.com"
            />

          </div>


          <div className="mt-4">

            <label className="text-sm font-medium text-slate-700">
              Password
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              required
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              placeholder="••••••••"
            />

          </div>


          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-lg bg-slate-950 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading
              ? "Signing in..."
              : "Sign In"}
          </button>


          <p className="mt-6 text-center text-sm text-slate-500">

            Don't have an account?{" "}

            <Link
              to="/register"
              className="font-medium text-slate-900 hover:underline"
            >
              Create one
            </Link>

          </p>

        </form>

      </div>

    </div>
  );
}