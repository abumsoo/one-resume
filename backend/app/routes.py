from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.db import get_session
from app.importer import import_cv
from app.models import Bullet, CvImport, Role
from app.pdf import PdfError, extract_text
from app.schemas import BulletOut, BulletUpdate, BulletVersionOut, ImportOut, RoleOut, RoleUpdate

router = APIRouter()


def _get[T](session: Session, model: type[T], id: int) -> T:
    obj = session.get(model, id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"{model.__name__} {id} not found")
    return obj


@router.post("/imports", status_code=status.HTTP_201_CREATED, tags=["import"])
def import_pdf(file: UploadFile, session: Session = Depends(get_session)) -> ImportOut:
    # A plain def: FastAPI runs it in a worker thread, so the blocking pdftotext
    # call doesn't stall other requests.
    # Re-import (matching new bullets to old ones) is not built yet, so only the
    # first import is accepted.
    if session.scalar(select(CvImport.id).limit(1)) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "A CV is already imported")
    data = file.file.read()
    if not data.startswith(b"%PDF"):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The file is not a PDF")
    try:
        text = extract_text(data)
    except PdfError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from exc
    if not text.strip():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "The PDF has no text")
    return import_cv(session, text, file.filename)


@router.get("/cv", tags=["cv"])
def get_cv(session: Session = Depends(get_session)) -> ImportOut:
    """The current CV: its header and non-archived roles."""
    record = session.scalars(select(CvImport).order_by(CvImport.id.desc()).limit(1)).first()
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No CV imported yet")
    roles = session.scalars(
        select(Role)
        .where(Role.cv_import_id == record.id, Role.archived_at.is_(None))
        .order_by(Role.position)
        .options(selectinload(Role.bullets))
    ).all()
    return ImportOut(id=record.id, filename=record.filename, header=record.header, roles=roles)


@router.get("/roles/{role_id}", tags=["cv"])
def get_role(role_id: int, session: Session = Depends(get_session)) -> RoleOut:
    return _get(session, Role, role_id)


@router.patch("/roles/{role_id}", tags=["cv"])
def update_role(
    role_id: int, body: RoleUpdate, session: Session = Depends(get_session)
) -> RoleOut:
    role = _get(session, Role, role_id)
    fields = body.model_dump(exclude_unset=True)
    if "section" in fields and fields["section"] is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Section can't be empty")
    if "section" in fields and fields["section"] != role.section and role.heading is None:
        # A section without entries (Skills, Summary) is one role with no heading.
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            "Only a role with a heading can move to another section",
        )
    for name, value in fields.items():
        setattr(role, name, value)
    session.commit()
    return role


@router.patch("/bullets/{bullet_id}", tags=["cv"])
def update_bullet(
    bullet_id: int, body: BulletUpdate, session: Session = Depends(get_session)
) -> BulletOut:
    bullet = _get(session, Bullet, bullet_id)
    if body.text is not None:
        bullet.set_text(body.text)
    if body.tags is not None:
        bullet.tags = body.tags
    session.commit()
    return bullet


@router.get("/bullets/{bullet_id}/versions", tags=["cv"])
def bullet_versions(
    bullet_id: int, session: Session = Depends(get_session)
) -> list[BulletVersionOut]:
    return _get(session, Bullet, bullet_id).versions
