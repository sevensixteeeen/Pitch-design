import psycopg

from app.migrate import migrate
from app.seed import DEMO_OWNER, DESIGNS, seed


def test_migrate_runs_each_file_once(database_url):
    # the session fixture already applied everything
    assert migrate(database_url) == []
    with psycopg.connect(database_url) as conn:
        names = [r[0] for r in conn.execute("select filename from schema_migrations order by filename")]
        assert names == ["0001_init.sql", "0002_deleted_accounts.sql"]


def test_rls_on_for_every_table(database_url):
    with psycopg.connect(database_url) as conn:
        off = conn.execute(
            "select relname from pg_class where relnamespace = 'public'::regnamespace "
            "and relkind = 'r' and not relrowsecurity"
        ).fetchall()
    assert off == []


def test_seed_content_is_valid(client, database_url):
    seed(database_url, DEMO_OWNER)
    with psycopg.connect(database_url) as conn:
        rows = conn.execute("select content from designs where owner_id = %s", (DEMO_OWNER,)).fetchall()
    assert len(rows) == len(DESIGNS)
    from app.document import DesignContent

    for (content,) in rows:
        DesignContent.model_validate(content)
