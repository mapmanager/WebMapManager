import inspect
from time import time
import pandas as pd

times = pd.DataFrame([], columns=["name", "time"])

def timer(func):
    return func
    # This function shows the execution time of
    # the function object passed
    def wrap_func(*args, **kwargs):
        global times
        t1 = time() * 1000
        result = func(*args, **kwargs)
        t2 = time() * 1000
        times.loc[len(times)] = [func.__name__, t2-t1]
        return result
    return wrap_func


def timeAll(func):
    return func
    # This function shows the execution time of
    # the function object passed
    
    if inspect.iscoroutinefunction(func):
        async def wrap_func(*args, **kwargs):
            global times
            t1 = time() * 1000
            result = await func(*args, **kwargs)
            t2 = time() * 1000

            print(f'Function {func.__name__!r} executed in {(t2-t1):.4f}ms')
            print(times.groupby("name").agg(
                ["count", "sum", "median", q90, "max"]).sort_values(by=("time", "sum"), ascending=False))
            times = pd.DataFrame([], columns=["name", "time"])
            return result
        return wrap_func

    def wrap_func(*args, **kwargs):
        global times
        t1 = time() * 1000
        result = func(*args, **kwargs)
        t2 = time() * 1000

        print(f'Function {func.__name__!r} executed in {(t2-t1):.4f}ms')
        print(times.groupby("name").agg(
            ["count", "sum", "median", q90, "max"]).sort_values(by=("time", "sum"), ascending=False))
        times = pd.DataFrame([], columns=["name", "time"])
        return result
    return wrap_func

def q90(x):
    return x.quantile(0.9)
