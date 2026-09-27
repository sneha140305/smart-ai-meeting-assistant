import chromadb

from sentence_transformers import SentenceTransformer
import ollama


MODEL_NAME = "llama3.2:3b"

CHROMA_PATH = "meeting_vector_db"

COLLECTION_NAME = "meeting_transcripts"

embedding_model = SentenceTransformer(
    "all-MiniLM-L6-v2"
)

client = chromadb.PersistentClient(
    path=CHROMA_PATH
)

collection = client.get_or_create_collection(
    name=COLLECTION_NAME
)

def create_chunks(
    segments: list,
    chunk_size: int = 5
):
    chunks = []

    for i in range(
        0,
        len(segments),
        chunk_size
    ):

        group = segments[
            i:i + chunk_size
        ]

        if not group:
            continue

        text_parts = []

        start = group[0]["start"]
        end = group[-1]["end"]

        for segment in group:

            speaker = segment.get(
                "speaker",
                "Unknown"
            )

            text = segment.get(
                "text",
                ""
            ).strip()

            if text:
                text_parts.append(
                    f"{speaker}: {text}"
                )

        text = "\n".join(text_parts)

        if text:
            chunks.append(
                {
                    "text": text,
                    "start": start,
                    "end": end
                }
            )

    return chunks

def index_meeting(
    meeting_id: int,
    segments: list
):
    chunks = create_chunks(
        segments
    )

    if not chunks:
        return 0

    meeting_key = str(meeting_id)

    # Remove old chunks for this meeting
    try:
        collection.delete(
            where={
                "meeting_id": meeting_key
            }
        )
    except Exception:
        pass

    documents = [
        chunk["text"]
        for chunk in chunks
    ]

    embeddings = embedding_model.encode(
        documents
    ).tolist()

    ids = [
        f"meeting_{meeting_id}_chunk_{i}"
        for i in range(len(chunks))
    ]

    metadatas = [
        {
            "meeting_id": meeting_key,
            "start": chunk["start"],
            "end": chunk["end"]
        }
        for chunk in chunks
    ]

    collection.add(
        ids=ids,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas
    )

    return len(chunks)

def search_meeting(
    meeting_id: int,
    question: str,
    top_k: int = 5
):
    query_embedding = embedding_model.encode(
        [question]
    ).tolist()

    results = collection.query(
        query_embeddings=query_embedding,
        n_results=top_k,
        where={
            "meeting_id": str(meeting_id)
        }
    )

    documents = results.get(
        "documents",
        [[]]
    )[0]

    metadatas = results.get(
        "metadatas",
        [[]]
    )[0]

    matches = []

    for document, metadata in zip(
        documents,
        metadatas
    ):
        matches.append(
            {
                "text": document,
                "start": metadata.get("start"),
                "end": metadata.get("end")
            }
        )

    return matches
import ollama


MODEL_NAME = "llama3.2:3b"

def answer_from_context(
    question: str,
    context_chunks: list
):

    context = "\n\n".join(
        [
            (
                f"[{chunk['start']:.2f}s - "
                f"{chunk['end']:.2f}s]\n"
                f"{chunk['text']}"
            )
            for chunk in context_chunks
        ]
    )

    prompt = f"""
You are an AI meeting assistant.

Answer the user's question using ONLY
the meeting context below.

Do not use outside knowledge.

Do not invent names, decisions,
deadlines, tasks, or facts.

If the answer cannot be determined
from the context, say:

"I couldn't find that information
in the relevant part of this meeting."

Keep the answer concise.

MEETING CONTEXT:
----------------
{context}
----------------

QUESTION:
{question}

ANSWER:
"""

    response = ollama.chat(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": prompt
            }
        ]
    )

    return response[
        "message"
    ]["content"].strip()

def ask_meeting_rag(
    meeting_id: int,
    question: str
):

    matches = search_meeting(
        meeting_id,
        question,
        top_k=5
    )

    if not matches:
        return {
            "answer": (
                "I couldn't find relevant "
                "information in this meeting."
            ),
            "sources": []
        }

    answer = answer_from_context(
        question,
        matches
    )

    return {
        "answer": answer,
        "sources": matches
    }