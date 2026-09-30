# Smart AI Meeting Assistant — Backend

## Run

From the `backend` directory:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

Create `backend/.env` locally (do not commit it):

```env
SECRET_KEY=replace-with-a-long-random-secret
HF_TOKEN=your-hugging-face-token
```

Required local services/tools:

- FFmpeg available on PATH
- Ollama running locally with `llama3.2:3b`
- Hugging Face access for `pyannote/speaker-diarization-community-1` if speaker diarization is desired

Ollama setup:

```powershell
ollama serve
ollama pull llama3.2:3b
```

API: `http://127.0.0.1:8000`

Run the lightweight tests with:

```powershell
pytest -q
```

