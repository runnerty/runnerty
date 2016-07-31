#!/usr/bin/env bash
#set -e;
sleep 40;
#echo di;

if [ -f "./test/fileflag.txt" ]
then
    echo "FICHERO ENCONTRADO"
	exit 0
else
    echo "NO EXISTE EL FICHERO"
	exit 1
fi