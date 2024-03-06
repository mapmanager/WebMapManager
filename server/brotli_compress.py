import brotli
import os
import sys


def compress_file(file_path):
    with open(file_path, 'rb') as input_file:
        file_contents = input_file.read()

    compressed_contents = brotli.compress(file_contents, quality=5)
    output_file_path = file_path + '.br'

    with open(output_file_path, 'wb') as output_file:
        output_file.write(compressed_contents)

    print(f"File compressed and saved as: {output_file_path}")


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Please provide a file path as an argument.")
        exit(1)

    file_path = sys.argv[1]
    compress_file(file_path)
