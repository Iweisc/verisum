
# verisum

## Idea

The core problem we are trying to solve is fuck u. no just kidding please keep reading, verisum is a project that allows you to consume the consice/exact content your looking for so you dont have to waste time reading people yap about shit. just get to the point with our app. oh and did i mention that it highlights the miss information. oh and did i mention that it also shows the sources/paragraphs it got the answer from. oh and did i mention.....jk.

## Todo

1. make the ui look clean and subtle (no neon circus).  
2. plug in the brain (rag + summarization).  
3. make it not hallucinate like your gf.  
4. optimize retrieval so it feels instant.  
5. test, cry, fix bugs, repeat.  

## Rag crash course for the dummy that is working on this shit 😭🙏

RAG = Retrieval-Augmented Generation. basically, it lets the AI pull real data. here’s the rundown:

1. user types a query.  
2. we turn that text into a vector (numbers, math, i know math scares you ;p).  
3. we search a vector db (like chroma, pinecone, faiss) for similar info.  
4. grab the best chunks of text.  
5. shove those chunks + the user’s query into the LLM.  
6. boom. it replies with real, sourced info instead of "vibes".

**core parts:**  
- LLM = the talker.  
- embedding model = the translator.  
- vector db = the librarian.  
- retriever = the fetcher.  
- prompt = the script.

TLDR; fuck u read the entire shit you lazy ass bi*ch
