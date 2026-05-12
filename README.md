## 

## Ocean-Acoustics-DOMES

## Overview

This project provides a high-performance web-based platform for underwater acoustic analysis. By efficiently distilling high-value marine mammal signals from massive datasets, it offers an end-to-end pipeline from data upload to real-time AI-driven detection. The platform supports a versatile range of downstream applications:

- Fine-grained acoustic target classification

- Underwater acoustic source localization and tracking

- Abundance estimation for Biological species and populations

- Distributed cooperative sensing by ocean mobile platforms

This project contributes to the protection of global marine biodiversity and promotes the sustainable development and utilization of marine biological resources through the power of underwater acoustic big data.

## Key Features

The repository serves as a reference implementation. Constrained by data sharing agreements, we have only open-sourced the complete responsive frontend software design alongside essential backend components for FastAPI integration. The platform currently supports several core functionalities: Spectrum View, Source Localization, Physical Simulation, AI Assistant, Platform Deployment, Environment Data, User Guide, Annotation Manager.

The software is built with a modular design emphasizing high cohesion and low coupling. Future functionalities will be further refined and expanded based on specific requirements.

## Quick Start

##### 1. Backend Setup

```bash
cd backend
pip install -r requirements.txt

python main.py
```

##### 2. Frontend Setup

Simply open `index.html` in a web browser to launch the interface.

## Acknowledge

This project is supported in part by the Fundamental Research Funds for the Central Universities (No.202572013) from the AI+ Ocean Doctoral Innovative Talents Support Program of Frontiers Science Center for Deep Ocean Multispheres and Earth System, Ocean University of China.
