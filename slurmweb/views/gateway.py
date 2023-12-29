# Copyright (c) 2023 Rackslab
#
# This file is part of Slurm-web.
#
# SPDX-License-Identifier: GPL-3.0-or-later

import json
import logging
from functools import wraps

from flask import Response, current_app, jsonify, request, abort
import requests
from rfl.web.tokens import check_jwt
from rfl.authentication.errors import LDAPAuthenticationError

from ..version import get_version


logger = logging.getLogger(__name__)


def validate_cluster(view):
    """Decorator for Flask views functions check for valid cluster path parameter."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        cluster = kwargs["cluster"]
        if cluster not in current_app.agents.keys():
            abort(
                404,
                f"Unable to retrieve {view.__name__} from cluster {cluster}, cluster "
                "not found",
            )
        return view(*args, **kwargs)

    return wrapped


def version():
    return Response(f"Slurm-web gateway v{get_version()}", mimetype="text/plain")


def login():
    try:
        idents = json.loads(request.data)
        user = current_app.authentifier.login(
            user=idents["user"], password=idents["password"]
        )
    except LDAPAuthenticationError as err:
        logger.warning(
            "LDAP authentication error for user %s: %s", idents["user"], str(err)
        )
        abort(401, str(err))
    logger.info("User %s authenticated successfully", user)
    # generate token
    token = current_app.jwt.generate(
        user=user, duration=current_app.settings.jwt.duration
    )
    return jsonify(
        result="Authentication successful",
        token=token,
        fullname=user.fullname,
        groups=user.groups,
    )


@check_jwt
def clusters():
    # get permissions on all agents
    clusters = []
    for agent in current_app.agents.values():
        cluster = {"name": agent.cluster}
        response = request_agent(agent.cluster, "permissions", request.token)
        if response.status_code != 200:
            logger.error(
                "Unable to retrieve permissions from cluster %s: %d",
                agent.cluster,
                response.status_code,
            )
            continue  # skip to next cluster

        permissions = response.json()
        cluster.update({"permissions": permissions})
        clusters.append(cluster)

        # If view-stats action is permitted on cluster, enrich response with
        # cluster stats.
        if "view-stats" in permissions["actions"]:
            response = request_agent(agent.cluster, "stats", request.token)
            if response.status_code != 200:
                logger.error(
                    "Unable to retrieve stats from cluster %s: %d",
                    agent.cluster,
                    response.status_code,
                )
            else:
                cluster.update({"stats": response.json()})
    return jsonify(
        clusters,
    )


@check_jwt
def users():
    return jsonify(
        [
            {"login": user.login, "fullname": user.fullname}
            for user in current_app.authentifier.users()
        ]
    )


def request_agent(cluster: str, query: str, token: str = None):
    headers = {}
    if token is not None:
        headers = {"Authorization": f"Bearer {token}"}
    try:
        return requests.get(
            f"{current_app.agents[cluster].url}/{query}",
            headers=headers,
        )
    except requests.exceptions.ConnectionError as err:
        logger.error("Connection error with agent %s: %s", cluster, str(err))
        abort(500, f"Connection error: {str(err)}")


def proxy_agent(cluster: str, query: str, token: str = None):
    response = request_agent(cluster, query, token)
    return jsonify(response.json()), response.status_code


@check_jwt
@validate_cluster
def stats(cluster: str):
    return proxy_agent(cluster, "stats", request.token)


@check_jwt
@validate_cluster
def jobs(cluster: str):
    return proxy_agent(cluster, "jobs", request.token)


@check_jwt
@validate_cluster
def job(cluster: str, job: int):
    return proxy_agent(cluster, f"job/{job}", request.token)


@check_jwt
@validate_cluster
def nodes(cluster: str):
    return proxy_agent(cluster, "nodes", request.token)


@check_jwt
@validate_cluster
def qos(cluster: str):
    return proxy_agent(cluster, "qos", request.token)


@check_jwt
@validate_cluster
def accounts(cluster: str):
    return proxy_agent(cluster, "accounts", request.token)
