#!/usr/bin/env python

import os
import zipfile

os.chdir(os.path.dirname(__file__))

me = os.path.basename(__file__)
output = "%s.xpi" % os.path.basename(os.path.abspath("."))

files = []

def recurse(path):
	for filename in os.listdir(path):
		if filename.startswith(".") \
		or filename.endswith("~") \
		or filename == output \
		or filename == me:
			continue
		relpath = os.path.join(path, filename)
		
		if os.path.isdir(relpath):
			recurse(relpath)
		else:
			files.append(relpath)

recurse(".")

fh = zipfile.ZipFile(output, "w")
for filename in sorted(files):
	print(filename)
	fh.write(filename)

