#! /usr/bin/env bash

echo "Starting build"
# The build script; we build the application step by step as building everything at once takes too much RAM
# Should be run from the repository root
# This is the main deployment script
rm -rf dist/*
rm -rf .cache
mkdir dist 2> /dev/null
mkdir dist/assets 2> /dev/null

export NODE_OPTIONS="--max-old-space-size=8192"

# This script ends every line with '&&' to chain everything. A failure will thus stop the build
npm run generate:editor-layer-index &&
npm run generate &&
npm run generate:layouts

if [ $? -ne 0 ]; then
    echo "ERROR - stopping the build"
    exit 1
fi



SRC_MAPS=""
BRANCH=`git rev-parse --abbrev-ref HEAD`
echo "The branch name is $BRANCH"
if [ $BRANCH = "develop" ]
then
    SRC_MAPS="--sourcemap"
    echo "Source maps are enabled"
fi

if [ $BRANCH = "master" ]
then
    ASSET_URL="./"
    export ASSET_URL
    echo "$ASSET_URL"
else
  ASSET_URL="mc/$BRANCH"
  export ASSET_URL
  echo "$ASSET_URL"
fi

export NODE_OPTIONS=--max-old-space-size=6500
vite build $SRC_MAPS 


# Copy the layer files, as these might contain assets (e.g. svgs)
cp -r assets/layers/ dist/assets/layers/
cp -r assets/themes/ dist/assets/themes/
cp -r assets/svg/ dist/assets/svg/

export NODE_OPTIONS=""
