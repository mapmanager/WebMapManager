import warnings
from .annotations.pyodide import PyodideAnnotations

warnings.filterwarnings("ignore")

async def createAnnotations(url: str) -> PyodideAnnotations:
    """
    Creates a new annotation object source using Pyodide.

    Args:
        url (str): The url to the folder containing all the data.

    Returns:
        PyodideAnnotations: PyodideAnnotations object.
    """
    return await PyodideAnnotations.load(url)
