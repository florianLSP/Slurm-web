# Copyright (c) 2023 Rackslab
#
# This file is part of Slurm-web.
#
# SPDX-License-Identifier: GPL-3.0-or-later


class SlurmwebRuntimeError(Exception):
    pass


class SlurmwebConfigurationError(Exception):
    pass


class SlurmwebAuthenticationError(Exception):
    pass


class SlurmwebCacheError(Exception):
    pass
