from app.services.processing_pipeline import process_meeting_pipeline


def process_meeting_job(meeting_id: int):
    """
    RQ worker entry point.
    """

    process_meeting_pipeline(meeting_id)