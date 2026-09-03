# scripts/

Repository maintenance and setup helpers.

| Script            | Purpose                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `setup-python.sh` | Create `.venv` and install the data pipeline (`pip install -e .[dev]`). |

Keep scripts small and dependency-free. Data-processing logic belongs in
`data-pipeline/`, not here.
